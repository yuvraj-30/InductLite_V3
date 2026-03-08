import * as Application from "expo-application";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { getDefaultReleaseChannel } from "../config/runtime";
import type { HeartbeatPayload } from "./mobileApi";

export function buildHeartbeatPayload(endpoint?: string): HeartbeatPayload {
  const platform = Platform.OS === "ios" ? "ios-native" : "android-native";
  return {
    endpoint,
    platform,
    appVersion: Application.nativeApplicationVersion || "0.0.0",
    osVersion: Device.osVersion || "unknown",
    wrapperChannel: getDefaultReleaseChannel(),
  };
}
