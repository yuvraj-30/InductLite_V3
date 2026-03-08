import * as Location from "expo-location";

export const GEOFENCE_TASK_NAME = "inductlite.geofence.task.v1";

export interface GeofenceConfig {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export async function requestLocationPermissions(): Promise<{
  foreground: Location.PermissionStatus;
  background: Location.PermissionStatus;
}> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  const background = await Location.requestBackgroundPermissionsAsync();
  return {
    foreground: foreground.status,
    background: background.status,
  };
}

export async function startGeofenceMonitoring(
  config: GeofenceConfig,
): Promise<void> {
  const region: Location.LocationRegion = {
    identifier: "site-primary",
    latitude: config.latitude,
    longitude: config.longitude,
    radius: Math.max(30, Math.min(config.radiusMeters, 1000)),
    notifyOnEnter: true,
    notifyOnExit: true,
  };

  await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, [region]);
}

export async function stopGeofenceMonitoring(): Promise<void> {
  const hasStarted = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
  if (hasStarted) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
  }
}

export async function isGeofenceMonitoringActive(): Promise<boolean> {
  return Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
}
