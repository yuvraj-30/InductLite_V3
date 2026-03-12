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
  useColorScheme,
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

type MobileTheme = {
  bgBase: string;
  bgSurface: string;
  bgSurfaceStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderSoft: string;
  accentPrimary: string;
  accentSecondary: string;
  success: string;
  warning: string;
  danger: string;
};

const mobileThemeLight: MobileTheme = {
  bgBase: "#f3f6fb",
  bgSurface: "#ffffff",
  bgSurfaceStrong: "#f8fbff",
  textPrimary: "#0f172a",
  textSecondary: "#334155",
  textMuted: "#64748b",
  borderSoft: "rgba(15, 23, 42, 0.11)",
  accentPrimary: "#1f73d8",
  accentSecondary: "#3b91f7",
  success: "#0f8a62",
  warning: "#a46105",
  danger: "#c7394a",
};

const mobileThemeDark: MobileTheme = {
  bgBase: "#07101d",
  bgSurface: "#0f1a2d",
  bgSurfaceStrong: "#14223a",
  textPrimary: "#e2e8f0",
  textSecondary: "#cbd5e1",
  textMuted: "#94a3b8",
  borderSoft: "rgba(148, 163, 184, 0.24)",
  accentPrimary: "#4b9dff",
  accentSecondary: "#7bb8ff",
  success: "#2fbe8b",
  warning: "#f0a43a",
  danger: "#fb7185",
};

type TierTone = "standard" | "plus" | "pro" | "addons";

type TierSnapshot = {
  key: "STANDARD" | "PLUS" | "PRO" | "ADD_ONS";
  label: string;
  tone: TierTone;
  highlights: string[];
};

const MOBILE_TIER_SNAPSHOT: TierSnapshot[] = [
  {
    key: "STANDARD",
    label: "Standard",
    tone: "standard",
    highlights: [
      "QR sign-in, inductions, live register",
      "Emergency roll-call and evidence exports",
    ],
  },
  {
    key: "PLUS",
    label: "Plus",
    tone: "plus",
    highlights: ["Everything in Standard", "Quiz/media depth and stronger field workflow controls"],
  },
  {
    key: "PRO",
    label: "Pro",
    tone: "pro",
    highlights: ["Everything in Plus", "Advanced analytics and connector depth"],
  },
  {
    key: "ADD_ONS",
    label: "Add-ons",
    tone: "addons",
    highlights: ["SMS, hardware access, premium connectors, implementation support"],
  },
];

function getTierToneColors(theme: MobileTheme, tone: TierTone) {
  if (tone === "plus") {
    return { backgroundColor: theme.accentPrimary, borderColor: theme.accentPrimary, textColor: "#ffffff" };
  }
  if (tone === "pro") {
    return { backgroundColor: theme.success, borderColor: theme.success, textColor: "#ffffff" };
  }
  if (tone === "addons") {
    return { backgroundColor: theme.warning, borderColor: theme.warning, textColor: "#ffffff" };
  }
  return { backgroundColor: theme.bgSurfaceStrong, borderColor: theme.borderSoft, textColor: theme.textPrimary };
}

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
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? mobileThemeDark : mobileThemeLight;
  const styles = useMemo(() => createStyles(theme), [theme]);

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
          <Text style={styles.cardTitle}>Tier Consistency Snapshot</Text>
          <Text style={styles.mutedText}>
            Standard, Plus, Pro, and Add-ons are reflected consistently across web and mobile surfaces.
          </Text>
          <View style={styles.tierGrid}>
            {MOBILE_TIER_SNAPSHOT.map((tier) => {
              const tone = getTierToneColors(theme, tier.tone);
              return (
                <View key={tier.key} style={[styles.tierCard, { borderColor: theme.borderSoft }]}>
                  <View
                    style={[
                      styles.tierPill,
                      { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor },
                    ]}
                  >
                    <Text style={[styles.tierPillText, { color: tone.textColor }]}>{tier.label}</Text>
                  </View>
                  {tier.highlights.map((item) => (
                    <Text key={item} style={styles.tierHighlight}>
                      {item}
                    </Text>
                  ))}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Core Setup</Text>

          <Text style={styles.label}>API Base URL</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            value={settings.apiBaseUrl}
            onChangeText={(value) => setSettings((prev) => (prev ? { ...prev, apiBaseUrl: value } : prev))}
            placeholder="https://your-domain.example"
            placeholderTextColor={theme.textMuted}
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
            placeholderTextColor={theme.textMuted}
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
                placeholderTextColor={theme.textMuted}
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
                placeholderTextColor={theme.textMuted}
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
                placeholderTextColor={theme.textMuted}
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
                placeholderTextColor={theme.textMuted}
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
              trackColor={{ false: theme.borderSoft, true: theme.accentPrimary }}
              thumbColor={settings.autoStartRuntime ? theme.accentSecondary : theme.bgSurfaceStrong}
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

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.bgBase,
    },
    container: {
      padding: 16,
      gap: 14,
    },
    title: {
      color: theme.textPrimary,
      fontSize: 28,
      fontWeight: "800",
    },
    subtitle: {
      color: theme.textSecondary,
      fontSize: 14,
    },
    card: {
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.bgSurface,
      borderRadius: 12,
      padding: 14,
      gap: 10,
    },
    cardTitle: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    tierGrid: {
      gap: 8,
    },
    tierCard: {
      borderWidth: 1,
      borderRadius: 10,
      backgroundColor: theme.bgSurfaceStrong,
      padding: 10,
      gap: 6,
    },
    tierPill: {
      alignSelf: "flex-start",
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    tierPillText: {
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    tierHighlight: {
      color: theme.textSecondary,
      fontSize: 12,
    },
    label: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    input: {
      borderWidth: 1,
      borderColor: theme.borderSoft,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: theme.textPrimary,
      backgroundColor: theme.bgSurfaceStrong,
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
      backgroundColor: theme.accentPrimary,
    },
    secondaryButton: {
      backgroundColor: theme.bgSurfaceStrong,
      borderWidth: 1,
      borderColor: theme.borderSoft,
    },
    primaryButtonText: {
      color: "#ffffff",
      fontWeight: "700",
    },
    secondaryButtonText: {
      color: theme.textPrimary,
      fontWeight: "600",
    },
    statusList: {
      gap: 4,
    },
    statusText: {
      color: theme.textPrimary,
      fontSize: 12,
    },
    mutedText: {
      color: theme.textMuted,
      fontSize: 12,
    },
    successText: {
      color: theme.success,
    },
    errorText: {
      color: theme.danger,
    },
  });
}
