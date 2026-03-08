import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { getDefaultApiBaseUrl } from "../config/runtime";

const SETTINGS_KEY = "inductlite.mobile.settings.v1";
const TOKEN_KEY = "inductlite.mobile.enrollmentToken.v1";

export interface MobileSettings {
  apiBaseUrl: string;
  enrollmentToken: string;
  geofenceLatitude: string;
  geofenceLongitude: string;
  geofenceRadiusM: string;
  heartbeatIntervalMinutes: string;
  autoStartRuntime: boolean;
}

interface PersistedMobileSettings {
  apiBaseUrl: string;
  geofenceLatitude: string;
  geofenceLongitude: string;
  geofenceRadiusM: string;
  heartbeatIntervalMinutes: string;
  autoStartRuntime: boolean;
}

const defaultSettings: MobileSettings = {
  apiBaseUrl: getDefaultApiBaseUrl(),
  enrollmentToken: "",
  geofenceLatitude: "-36.8485",
  geofenceLongitude: "174.7633",
  geofenceRadiusM: "180",
  heartbeatIntervalMinutes: "5",
  autoStartRuntime: false,
};

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return getDefaultApiBaseUrl();
  try {
    const parsed = new URL(trimmed);
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return getDefaultApiBaseUrl();
  }
}

function normalizeNumericString(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return fallback;
  return String(parsed);
}

function toPersisted(settings: MobileSettings): PersistedMobileSettings {
  return {
    apiBaseUrl: normalizeUrl(settings.apiBaseUrl),
    geofenceLatitude: normalizeNumericString(settings.geofenceLatitude, defaultSettings.geofenceLatitude),
    geofenceLongitude: normalizeNumericString(settings.geofenceLongitude, defaultSettings.geofenceLongitude),
    geofenceRadiusM: normalizeNumericString(settings.geofenceRadiusM, defaultSettings.geofenceRadiusM),
    heartbeatIntervalMinutes: normalizeNumericString(
      settings.heartbeatIntervalMinutes,
      defaultSettings.heartbeatIntervalMinutes,
    ),
    autoStartRuntime: settings.autoStartRuntime === true,
  };
}

export async function loadMobileSettings(): Promise<MobileSettings> {
  const [rawSettings, enrollmentToken] = await Promise.all([
    AsyncStorage.getItem(SETTINGS_KEY),
    SecureStore.getItemAsync(TOKEN_KEY),
  ]);

  if (!rawSettings) {
    return {
      ...defaultSettings,
      enrollmentToken: enrollmentToken ?? "",
    };
  }

  try {
    const parsed = JSON.parse(rawSettings) as Partial<PersistedMobileSettings>;
    return {
      apiBaseUrl: normalizeUrl(parsed.apiBaseUrl ?? defaultSettings.apiBaseUrl),
      enrollmentToken: enrollmentToken ?? "",
      geofenceLatitude: normalizeNumericString(
        parsed.geofenceLatitude ?? defaultSettings.geofenceLatitude,
        defaultSettings.geofenceLatitude,
      ),
      geofenceLongitude: normalizeNumericString(
        parsed.geofenceLongitude ?? defaultSettings.geofenceLongitude,
        defaultSettings.geofenceLongitude,
      ),
      geofenceRadiusM: normalizeNumericString(
        parsed.geofenceRadiusM ?? defaultSettings.geofenceRadiusM,
        defaultSettings.geofenceRadiusM,
      ),
      heartbeatIntervalMinutes: normalizeNumericString(
        parsed.heartbeatIntervalMinutes ?? defaultSettings.heartbeatIntervalMinutes,
        defaultSettings.heartbeatIntervalMinutes,
      ),
      autoStartRuntime: parsed.autoStartRuntime === true,
    };
  } catch {
    return {
      ...defaultSettings,
      enrollmentToken: enrollmentToken ?? "",
    };
  }
}

export async function saveMobileSettings(settings: MobileSettings): Promise<void> {
  const persisted = toPersisted(settings);
  await Promise.all([
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(persisted)),
    SecureStore.setItemAsync(TOKEN_KEY, settings.enrollmentToken.trim()),
  ]);
}

export async function clearMobileSettings(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(SETTINGS_KEY),
    SecureStore.deleteItemAsync(TOKEN_KEY),
  ]);
}
