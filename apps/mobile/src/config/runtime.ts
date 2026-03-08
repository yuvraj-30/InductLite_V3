import Constants from "expo-constants";

interface RuntimeExtraConfig {
  mobileApiBaseUrl?: string;
  mobileWrapperRuntime?: string;
  mobileReleaseChannel?: string;
  mobileIosAppStoreUrl?: string;
  mobileAndroidPlayUrl?: string;
  mobileIosMinVersion?: string;
  mobileAndroidMinVersion?: string;
}

function readExtra(): RuntimeExtraConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as RuntimeExtraConfig;
  return extra;
}

function normalizeUrl(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  try {
    const parsed = new URL(trimmed);
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

export function getDefaultApiBaseUrl(): string {
  const extra = readExtra();
  return normalizeUrl(extra.mobileApiBaseUrl, "http://127.0.0.1:3000");
}

export function getDefaultWrapperRuntime(): string {
  return readExtra().mobileWrapperRuntime?.trim() || "expo-managed";
}

export function getDefaultReleaseChannel(): string {
  return readExtra().mobileReleaseChannel?.trim() || "development";
}

export function getDistributionMetadata(): {
  iosAppStoreUrl: string;
  androidPlayUrl: string;
  iosMinVersion: string;
  androidMinVersion: string;
} {
  const extra = readExtra();
  return {
    iosAppStoreUrl:
      extra.mobileIosAppStoreUrl?.trim() || "https://apps.apple.com/app/id0000000000",
    androidPlayUrl:
      extra.mobileAndroidPlayUrl?.trim() ||
      "https://play.google.com/store/apps/details?id=com.placeholder.inductlite.mobile",
    iosMinVersion: extra.mobileIosMinVersion?.trim() || "1.0.0",
    androidMinVersion: extra.mobileAndroidMinVersion?.trim() || "1.0.0",
  };
}
