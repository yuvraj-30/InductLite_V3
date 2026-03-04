import { createHash, timingSafeEqual } from "crypto";

export type GeofenceEnforcementMode = "AUDIT" | "DENY" | "OVERRIDE";

export interface GeofenceEnforcementConfig {
  mode: GeofenceEnforcementMode;
  allowMissingLocation: boolean;
  overrideCodeHash: string | null;
  updatedAt: string | null;
}

export interface HardwareAccessConfig {
  enabled: boolean;
  provider: string | null;
  endpointUrl: string | null;
  authToken: string | null;
  updatedAt: string | null;
}

export interface AccessControlConfig {
  version: 1;
  geofence: GeofenceEnforcementConfig;
  hardware: HardwareAccessConfig;
}

const DEFAULT_GEOFENCE_CONFIG: GeofenceEnforcementConfig = {
  mode: "AUDIT",
  allowMissingLocation: true,
  overrideCodeHash: null,
  updatedAt: null,
};

const DEFAULT_HARDWARE_CONFIG: HardwareAccessConfig = {
  enabled: false,
  provider: null,
  endpointUrl: null,
  authToken: null,
  updatedAt: null,
};

function normalizeMode(value: unknown): GeofenceEnforcementMode {
  if (typeof value !== "string") {
    return "AUDIT";
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "DENY" || normalized === "OVERRIDE") {
    return normalized;
  }
  return "AUDIT";
}

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function normalizeIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function normalizeOverrideCodeHash(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function hashGeofenceOverrideCode(value: string): string {
  return createHash("sha256")
    .update(value.trim())
    .digest("hex")
    .toLowerCase();
}

export function verifyGeofenceOverrideCode(
  storedHash: string | null,
  candidate: string | null | undefined,
): boolean {
  if (!storedHash || !candidate || candidate.trim().length === 0) {
    return false;
  }

  const expected = Buffer.from(storedHash, "utf8");
  const actual = Buffer.from(hashGeofenceOverrideCode(candidate), "utf8");
  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export function parseAccessControlConfig(input: unknown): AccessControlConfig {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      version: 1,
      geofence: { ...DEFAULT_GEOFENCE_CONFIG },
      hardware: { ...DEFAULT_HARDWARE_CONFIG },
    };
  }

  const objectInput = input as Record<string, unknown>;
  const rawGeofence =
    objectInput.geofence && typeof objectInput.geofence === "object"
      ? (objectInput.geofence as Record<string, unknown>)
      : {};
  const rawHardware =
    objectInput.hardware && typeof objectInput.hardware === "object"
      ? (objectInput.hardware as Record<string, unknown>)
      : {};

  const endpointUrl = normalizeUrl(rawHardware.endpointUrl);
  const provider = normalizeString(rawHardware.provider, 80);

  return {
    version: 1,
    geofence: {
      mode: normalizeMode(rawGeofence.mode),
      allowMissingLocation: rawGeofence.allowMissingLocation !== false,
      overrideCodeHash: normalizeOverrideCodeHash(rawGeofence.overrideCodeHash),
      updatedAt: normalizeIsoTimestamp(rawGeofence.updatedAt),
    },
    hardware: {
      enabled: rawHardware.enabled === true && endpointUrl !== null,
      provider,
      endpointUrl,
      authToken: normalizeString(rawHardware.authToken, 512),
      updatedAt: normalizeIsoTimestamp(rawHardware.updatedAt),
    },
  };
}

export function buildAccessControlConfig(input: {
  geofenceMode: GeofenceEnforcementMode;
  geofenceAllowMissingLocation: boolean;
  geofenceOverrideCode?: string | null;
  clearGeofenceOverrideCode?: boolean;
  hardwareEnabled: boolean;
  hardwareProvider?: string | null;
  hardwareEndpointUrl?: string | null;
  hardwareAuthToken?: string | null;
  clearHardwareAuthToken?: boolean;
  existingConfig?: AccessControlConfig | null;
}): AccessControlConfig {
  const existing = input.existingConfig ?? parseAccessControlConfig(null);
  const nextOverrideCodeHash = input.clearGeofenceOverrideCode
    ? null
    : input.geofenceOverrideCode && input.geofenceOverrideCode.trim().length > 0
      ? hashGeofenceOverrideCode(input.geofenceOverrideCode)
      : existing.geofence.overrideCodeHash;
  const endpointUrl = normalizeUrl(input.hardwareEndpointUrl);
  const provider = normalizeString(input.hardwareProvider, 80);
  const authToken = normalizeString(input.hardwareAuthToken, 512);
  const nextHardwareAuthToken = input.clearHardwareAuthToken
    ? null
    : authToken ?? existing.hardware.authToken;
  const nowIso = new Date().toISOString();

  return {
    version: 1,
    geofence: {
      mode: input.geofenceMode,
      allowMissingLocation: input.geofenceAllowMissingLocation,
      overrideCodeHash: nextOverrideCodeHash,
      updatedAt: nowIso,
    },
    hardware: {
      enabled: input.hardwareEnabled && endpointUrl !== null,
      provider,
      endpointUrl,
      authToken: nextHardwareAuthToken,
      updatedAt:
        input.hardwareEnabled && endpointUrl !== null
          ? nowIso
          : existing.hardware.updatedAt,
    },
  };
}

export function hasHardwareAccessTarget(config: AccessControlConfig): boolean {
  return config.hardware.enabled && config.hardware.endpointUrl !== null;
}
