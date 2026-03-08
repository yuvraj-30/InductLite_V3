import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  type EnrollmentTokenPayload,
  formatEnrollmentExpiry,
  isEnrollmentTokenExpired,
  parseEnrollmentTokenPayload,
} from "./src/services/enrollmentToken";
import {
  type MobileSettings,
  clearMobileSettings,
  loadMobileSettings,
  saveMobileSettings,
} from "./src/storage/mobileSettings";
import {
  isGeofenceMonitoringActive,
  requestLocationPermissions,
  startGeofenceMonitoring,
  stopGeofenceMonitoring,
} from "./src/services/geofenceRuntime";
import { buildHeartbeatPayload } from "./src/services/deviceRuntime";
import { sendHeartbeat, type GeofenceEventType } from "./src/services/mobileApi";
import {
  clearGeofenceQueue,
  enqueueGeofenceEvent,
  flushQueuedGeofenceEvents,
  loadGeofenceQueue,
} from "./src/services/eventQueue";
import { createEventId } from "./src/utils/id";
import { getDistributionMetadata, getDefaultWrapperRuntime } from "./src/config/runtime";

const queueRefreshIntervalMs = 5000;

function normalizeNumeric(
  value: string,
  fallback: number,
  options?: { min?: number; max?: number },
): number {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) return fallback;
  const min = options?.min ?? Number.NEGATIVE_INFINITY;
  const max = options?.max ?? Number.POSITIVE_INFINITY;
  return Math.min(max, Math.max(min, parsed));
}

function formatTime(value: Date | null): string {
  if (!value) return "-";
  return value.toLocaleString("en-NZ");
}

export default function App() {
  const [settings, setSettings] = useState<MobileSettings | null>(null);
  const [runtimeActive, setRuntimeActive] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [lastMessage, setLastMessage] = useState("Ready");
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<Date | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tokenPayload: EnrollmentTokenPayload | null = useMemo(() => {
    if (!settings) return null;
    return parseEnrollmentTokenPayload(settings.enrollmentToken);
  }, [settings]);

  const distribution = useMemo(() => getDistributionMetadata(), []);

  const stopHeartbeatLoop = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const refreshQueueCount = useCallback(async () => {
    const queue = await loadGeofenceQueue();
    setQueueCount(queue.length);
  }, []);

  const runHeartbeatNow = useCallback(async () => {
    if (!settings || !tokenPayload) {
      return;
    }

    const result = await sendHeartbeat(
      settings.apiBaseUrl,
      settings.enrollmentToken,
      buildHeartbeatPayload(tokenPayload.endpoint),
    );

    if (!result.ok) {
      setLastError(result.error ?? "Heartbeat failed");
      setLastMessage("Heartbeat failed");
      return;
    }

    setLastHeartbeatAt(new Date());
    setLastError(null);
    setLastMessage("Heartbeat sent successfully");
  }, [settings, tokenPayload]);

  const flushQueueNow = useCallback(async () => {
    if (!settings) return;
    if (!settings.enrollmentToken.trim()) {
      setLastError("Enrollment token is required before replay can run.");
      return;
    }

    const result = await flushQueuedGeofenceEvents({
      apiBaseUrl: settings.apiBaseUrl,
      enrollmentToken: settings.enrollmentToken,
    });

    await refreshQueueCount();

    if (result.error) {
      setLastError(result.error);
      setLastMessage(`Replay failed (${result.failed}/${result.attempted})`);
      return;
    }

    setLastError(null);
    setLastMessage(
      `Replay complete: sent ${result.sent}, failed ${result.failed}, remaining ${result.remaining}`,
    );
  }, [refreshQueueCount, settings]);

  const startHeartbeatLoop = useCallback(() => {
    if (!settings || !tokenPayload) return;

    stopHeartbeatLoop();

    const intervalMinutes = normalizeNumeric(settings.heartbeatIntervalMinutes, 5, {
      min: 1,
      max: 60,
    });
    const intervalMs = intervalMinutes * 60 * 1000;

    const runTick = async () => {
      await runHeartbeatNow();
      await flushQueueNow();
    };

    void runTick();
    heartbeatIntervalRef.current = setInterval(() => {
      void runTick();
    }, intervalMs);
  }, [flushQueueNow, runHeartbeatNow, settings, stopHeartbeatLoop, tokenPayload]);

  const startRuntime = useCallback(async () => {
    if (!settings) return;

    if (!tokenPayload) {
      setLastError("Enrollment token is invalid.");
      return;
    }
    if (isEnrollmentTokenExpired(tokenPayload)) {
      setLastError("Enrollment token has expired. Issue a new token from admin.");
      return;
    }

    const latitude = normalizeNumeric(settings.geofenceLatitude, NaN, {
      min: -90,
      max: 90,
    });
    const longitude = normalizeNumeric(settings.geofenceLongitude, NaN, {
      min: -180,
      max: 180,
    });
    const radiusMeters = normalizeNumeric(settings.geofenceRadiusM, 180, {
      min: 30,
      max: 1000,
    });

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setLastError("Geofence latitude/longitude are invalid.");
      return;
    }

    setIsBusy(true);
    try {
      const permissions = await requestLocationPermissions();
      if (permissions.foreground !== "granted") {
        setLastError("Foreground location permission is required.");
        return;
      }
      if (permissions.background !== "granted") {
        setLastError("Background location permission is required for geofence reliability.");
        return;
      }

      await startGeofenceMonitoring({ latitude, longitude, radiusMeters });
      setRuntimeActive(true);
      setLastError(null);
      setLastMessage("Runtime started: geofence monitoring active.");
      startHeartbeatLoop();
      await flushQueueNow();
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error));
      setLastMessage("Failed to start runtime");
    } finally {
      setIsBusy(false);
    }
  }, [flushQueueNow, settings, startHeartbeatLoop, tokenPayload]);

  const stopRuntime = useCallback(async () => {
    setIsBusy(true);
    try {
      stopHeartbeatLoop();
      await stopGeofenceMonitoring();
      setRuntimeActive(false);
      setLastError(null);
      setLastMessage("Runtime stopped.");
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error));
      setLastMessage("Failed to stop runtime");
    } finally {
      setIsBusy(false);
    }
  }, [stopHeartbeatLoop]);

  const saveSettingsAction = useCallback(async () => {
    if (!settings) return;
    setIsBusy(true);
    try {
      await saveMobileSettings(settings);
      setLastError(null);
      setLastMessage("Settings saved securely.");
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error));
      setLastMessage("Failed to save settings");
    } finally {
      setIsBusy(false);
    }
  }, [settings]);

  const clearSettingsAction = useCallback(async () => {
    setIsBusy(true);
    try {
      await clearMobileSettings();
      await clearGeofenceQueue();
      const loaded = await loadMobileSettings();
      setSettings(loaded);
      setLastError(null);
      setLastMessage("Settings and queued events cleared.");
      await refreshQueueCount();
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error));
      setLastMessage("Failed to clear settings");
    } finally {
      setIsBusy(false);
    }
  }, [refreshQueueCount]);

  const enqueueTestEvent = useCallback(
    async (eventType: GeofenceEventType) => {
      if (!settings || !tokenPayload) {
        setLastError("Save a valid enrollment token first.");
        return;
      }

      const latitude = normalizeNumeric(settings.geofenceLatitude, -36.8485, {
        min: -90,
        max: 90,
      });
      const longitude = normalizeNumeric(settings.geofenceLongitude, 174.7633, {
        min: -180,
        max: 180,
      });

      await enqueueGeofenceEvent({
        eventId: createEventId("manual"),
        eventType,
        occurredAt: new Date().toISOString(),
        latitude,
        longitude,
        endpoint: tokenPayload.endpoint,
      });

      await refreshQueueCount();
      setLastMessage(`Queued ${eventType} event.`);
      setLastError(null);
    },
    [refreshQueueCount, settings, tokenPayload],
  );

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const loaded = await loadMobileSettings();
      const active = await isGeofenceMonitoringActive();
      if (cancelled) return;
      setSettings(loaded);
      setRuntimeActive(active);
      await refreshQueueCount();
      if (loaded.autoStartRuntime && loaded.enrollmentToken.trim().length > 0) {
        await startRuntime();
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      stopHeartbeatLoop();
    };
  }, [refreshQueueCount, startRuntime, stopHeartbeatLoop]);

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshQueueCount();
    }, queueRefreshIntervalMs);

    return () => clearInterval(timer);
  }, [refreshQueueCount]);

  if (!settings) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.container}>
          <Text style={styles.title}>Loading InductLite Mobile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>InductLite Mobile Runtime</Text>
        <Text style={styles.subtitle}>
          Native iOS/Android geofence shell for your existing sign-in platform.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Core Setup</Text>

          <Text style={styles.label}>API Base URL</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            value={settings.apiBaseUrl}
            onChangeText={(value) => setSettings((prev) => (prev ? { ...prev, apiBaseUrl: value } : prev))}
            placeholder="https://your-domain.example"
          />

          <Text style={styles.label}>Enrollment Token</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            multiline
            value={settings.enrollmentToken}
            onChangeText={(value) =>
              setSettings((prev) => (prev ? { ...prev, enrollmentToken: value } : prev))
            }
            placeholder="Paste token from /api/mobile/enrollment-token"
          />

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Geofence Latitude</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={settings.geofenceLatitude}
                onChangeText={(value) =>
                  setSettings((prev) => (prev ? { ...prev, geofenceLatitude: value } : prev))
                }
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Geofence Longitude</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={settings.geofenceLongitude}
                onChangeText={(value) =>
                  setSettings((prev) => (prev ? { ...prev, geofenceLongitude: value } : prev))
                }
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Radius (m)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={settings.geofenceRadiusM}
                onChangeText={(value) =>
                  setSettings((prev) => (prev ? { ...prev, geofenceRadiusM: value } : prev))
                }
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Heartbeat (min)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={settings.heartbeatIntervalMinutes}
                onChangeText={(value) =>
                  setSettings((prev) =>
                    prev ? { ...prev, heartbeatIntervalMinutes: value } : prev,
                  )
                }
              />
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.label}>Auto-start runtime on launch</Text>
            <Switch
              value={settings.autoStartRuntime}
              onValueChange={(value) =>
                setSettings((prev) => (prev ? { ...prev, autoStartRuntime: value } : prev))
              }
            />
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, styles.primaryButton]}
              onPress={() => void saveSettingsAction()}
              disabled={isBusy}
            >
              <Text style={styles.primaryButtonText}>Save Settings</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() => {
                Alert.alert(
                  "Clear mobile settings",
                  "This removes the enrollment token and all local runtime settings.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Clear",
                      style: "destructive",
                      onPress: () => void clearSettingsAction(),
                    },
                  ],
                );
              }}
              disabled={isBusy}
            >
              <Text style={styles.secondaryButtonText}>Clear</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Enrollment Token Details</Text>
          {tokenPayload ? (
            <View style={styles.statusList}>
              <Text style={styles.statusText}>Company: {tokenPayload.companyId}</Text>
              <Text style={styles.statusText}>Site: {tokenPayload.siteId}</Text>
              <Text style={styles.statusText}>Endpoint: {tokenPayload.endpoint}</Text>
              <Text style={styles.statusText}>Visitor: {tokenPayload.visitorName}</Text>
              <Text style={styles.statusText}>Expires: {formatEnrollmentExpiry(tokenPayload)}</Text>
              <Text
                style={[
                  styles.statusText,
                  isEnrollmentTokenExpired(tokenPayload)
                    ? styles.errorText
                    : styles.successText,
                ]}
              >
                {isEnrollmentTokenExpired(tokenPayload) ? "Token expired" : "Token valid"}
              </Text>
            </View>
          ) : (
            <Text style={styles.mutedText}>Token is missing or invalid.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Runtime Controls</Text>
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, styles.primaryButton]}
              onPress={() => void startRuntime()}
              disabled={isBusy}
            >
              <Text style={styles.primaryButtonText}>Start Runtime</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() => void stopRuntime()}
              disabled={isBusy}
            >
              <Text style={styles.secondaryButtonText}>Stop Runtime</Text>
            </Pressable>
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() => void enqueueTestEvent("ENTRY")}
            >
              <Text style={styles.secondaryButtonText}>Queue ENTRY</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() => void enqueueTestEvent("EXIT")}
            >
              <Text style={styles.secondaryButtonText}>Queue EXIT</Text>
            </Pressable>
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() => void flushQueueNow()}
            >
              <Text style={styles.secondaryButtonText}>Replay Queue</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() => void runHeartbeatNow()}
            >
              <Text style={styles.secondaryButtonText}>Heartbeat Now</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Runtime Status</Text>
          <View style={styles.statusList}>
            <Text style={styles.statusText}>Runtime: {runtimeActive ? "ACTIVE" : "STOPPED"}</Text>
            <Text style={styles.statusText}>Queued geofence events: {queueCount}</Text>
            <Text style={styles.statusText}>Last heartbeat: {formatTime(lastHeartbeatAt)}</Text>
            <Text style={styles.statusText}>Wrapper runtime: {getDefaultWrapperRuntime()}</Text>
            <Text style={styles.statusText}>iOS URL: {distribution.iosAppStoreUrl}</Text>
            <Text style={styles.statusText}>Android URL: {distribution.androidPlayUrl}</Text>
            <Text style={styles.statusText}>iOS min version: {distribution.iosMinVersion}</Text>
            <Text style={styles.statusText}>Android min version: {distribution.androidMinVersion}</Text>
          </View>

          <Text style={styles.mutedText}>Last message: {lastMessage}</Text>
          {lastError ? <Text style={[styles.mutedText, styles.errorText]}>Error: {lastError}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Credential Placeholders</Text>
          <Text style={styles.mutedText}>
            Update placeholder values in `apps/mobile/.env.example`, `apps/mobile/app.config.ts`,
            and `apps/mobile/credentials/` before production distribution.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0b1220",
  },
  container: {
    padding: 16,
    gap: 14,
  },
  title: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#cbd5e1",
    fontSize: 14,
  },
  card: {
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
  },
  label: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#f8fafc",
    backgroundColor: "#0f172a",
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  col: {
    flex: 1,
    gap: 6,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  button: {
    minHeight: 40,
    minWidth: 130,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  primaryButton: {
    backgroundColor: "#0ea5e9",
  },
  secondaryButton: {
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#334155",
  },
  primaryButtonText: {
    color: "#0f172a",
    fontWeight: "700",
  },
  secondaryButtonText: {
    color: "#e2e8f0",
    fontWeight: "600",
  },
  statusList: {
    gap: 4,
  },
  statusText: {
    color: "#e2e8f0",
    fontSize: 12,
  },
  mutedText: {
    color: "#94a3b8",
    fontSize: 12,
  },
  successText: {
    color: "#22c55e",
  },
  errorText: {
    color: "#f87171",
  },
});
