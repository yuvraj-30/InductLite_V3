export const PermissionStatus = {
  GRANTED: "granted",
  DENIED: "denied",
} as const;

export const GeofencingEventType = {
  Enter: 1,
  Exit: 2,
} as const;

export async function requestForegroundPermissionsAsync(): Promise<{
  status: string;
}> {
  return { status: PermissionStatus.GRANTED };
}

export async function requestBackgroundPermissionsAsync(): Promise<{
  status: string;
}> {
  return { status: PermissionStatus.GRANTED };
}

export async function startGeofencingAsync(): Promise<void> {}

export async function stopGeofencingAsync(): Promise<void> {}

export async function hasStartedGeofencingAsync(): Promise<boolean> {
  return false;
}
