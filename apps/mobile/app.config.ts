import type { ConfigContext, ExpoConfig } from "expo/config";

function readEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function readEnvAny(names: string[], fallback: string): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value && value.length > 0) return value;
  }
  return fallback;
}

function normalizeUrl(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  try {
    return new URL(trimmed).toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const appName = readEnv("EXPO_PUBLIC_MOBILE_APP_NAME", "InductLite Mobile");
  const slug = readEnv("EXPO_PUBLIC_MOBILE_SLUG", "inductlite-mobile");
  const scheme = readEnv("EXPO_PUBLIC_MOBILE_SCHEME", "inductlite");
  const iosBundleIdentifier = readEnv(
    "EXPO_PUBLIC_MOBILE_IOS_BUNDLE_ID",
    "com.placeholder.inductlite.mobile",
  );
  const androidPackage = readEnv(
    "EXPO_PUBLIC_MOBILE_ANDROID_PACKAGE",
    "com.placeholder.inductlite.mobile",
  );

  const mobileApiBaseUrl = normalizeUrl(
    readEnv("EXPO_PUBLIC_MOBILE_API_BASE_URL", "http://127.0.0.1:3000"),
    "http://127.0.0.1:3000",
  );
  const mobileWrapperRuntime = readEnvAny(
    ["EXPO_PUBLIC_MOBILE_WRAPPER_RUNTIME", "MOBILE_WRAPPER_RUNTIME"],
    "expo-managed",
  );
  const mobileReleaseChannel = readEnvAny(
    ["EXPO_PUBLIC_MOBILE_RELEASE_CHANNEL", "MOBILE_RELEASE_CHANNEL"],
    "development",
  );
  const mobileIosAppStoreUrl = readEnvAny(
    ["EXPO_PUBLIC_MOBILE_IOS_APPSTORE_URL", "MOBILE_IOS_APPSTORE_URL"],
    "https://apps.apple.com/app/id0000000000",
  );
  const mobileAndroidPlayUrl = readEnvAny(
    ["EXPO_PUBLIC_MOBILE_ANDROID_PLAY_URL", "MOBILE_ANDROID_PLAY_URL"],
    "https://play.google.com/store/apps/details?id=com.placeholder.inductlite.mobile",
  );
  const mobileIosMinVersion = readEnvAny(
    ["EXPO_PUBLIC_MOBILE_IOS_MIN_VERSION", "MOBILE_IOS_MIN_VERSION"],
    "1.0.0",
  );
  const mobileAndroidMinVersion = readEnvAny(
    ["EXPO_PUBLIC_MOBILE_ANDROID_MIN_VERSION", "MOBILE_ANDROID_MIN_VERSION"],
    "1.0.0",
  );
  const easProjectId = readEnv(
    "EXPO_PUBLIC_MOBILE_EAS_PROJECT_ID",
    "00000000-0000-0000-0000-000000000000",
  );

  return {
    ...config,
    name: appName,
    slug,
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    scheme,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#f8f2e8",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: iosBundleIdentifier,
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "InductLite uses location while using the app to verify site check-in and check-out.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "InductLite uses background location for automatic geofence check-in and check-out.",
        UIBackgroundModes: ["location"],
      },
    },
    android: {
      package: androidPackage,
      adaptiveIcon: {
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
        backgroundColor: "#f2e7d2",
      },
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "RECEIVE_BOOT_COMPLETED",
      ],
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "InductLite uses your location to confirm you are at the correct site.",
          locationAlwaysAndWhenInUsePermission:
            "InductLite uses your location in the background for automated geofence events.",
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
        },
      ],
      "expo-secure-store",
    ],
    updates: {
      fallbackToCacheTimeout: 0,
    },
    runtimeVersion: {
      policy: "appVersion",
    },
    extra: {
      mobileApiBaseUrl,
      mobileWrapperRuntime,
      mobileReleaseChannel,
      mobileIosAppStoreUrl,
      mobileAndroidPlayUrl,
      mobileIosMinVersion,
      mobileAndroidMinVersion,
      eas: {
        projectId: easProjectId,
      },
    },
  };
};
