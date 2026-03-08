import { createHash, timingSafeEqual } from "crypto";

export type GeofenceEnforcementMode = "AUDIT" | "DENY" | "OVERRIDE";
export type GeofenceAutomationMode = "OFF" | "ASSIST" | "AUTO";
export type IdentityOcrDecisionMode = "assist" | "strict";

export interface GeofenceEnforcementConfig {
  mode: GeofenceEnforcementMode;
  allowMissingLocation: boolean;
  overrideCodeHash: string | null;
  automationMode: GeofenceAutomationMode;
  autoCheckoutGraceMinutes: number;
  updatedAt: string | null;
}

export interface HardwareAccessConfig {
  enabled: boolean;
  provider: string | null;
  endpointUrl: string | null;
  authToken: string | null;
  updatedAt: string | null;
}

export interface VisitorIdentityConfig {
  enabled: boolean;
  requirePhoto: boolean;
  requireIdScan: boolean;
  requireConsent: boolean;
  requireOcrVerification: boolean;
  allowedDocumentTypes: string[];
  ocrDecisionMode: IdentityOcrDecisionMode;
  updatedAt: string | null;
}

export interface AccessControlConfig {
  version: 1;
  geofence: GeofenceEnforcementConfig;
  hardware: HardwareAccessConfig;
  identity: VisitorIdentityConfig;
}

const DEFAULT_GEOFENCE_CONFIG: GeofenceEnforcementConfig = {
  mode: "AUDIT",
  allowMissingLocation: true,
  overrideCodeHash: null,
  automationMode: "OFF",
  autoCheckoutGraceMinutes: 30,
  updatedAt: null,
};

const DEFAULT_HARDWARE_CONFIG: HardwareAccessConfig = {
  enabled: false,
  provider: null,
  endpointUrl: null,
  authToken: null,
  updatedAt: null,
};

const DEFAULT_IDENTITY_CONFIG: VisitorIdentityConfig = {
  enabled: false,
  requirePhoto: false,
  requireIdScan: false,
  requireConsent: true,
  requireOcrVerification: false,
  allowedDocumentTypes: ["DRIVER_LICENCE", "PASSPORT"],
  ocrDecisionMode: "assist",
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

function normalizeAutomationMode(value: unknown): GeofenceAutomationMode {
  if (typeof value !== "string") {
    return "OFF";
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "ASSIST" || normalized === "AUTO") {
    return normalized;
  }
  return "OFF";
}

function normalizeAutoCheckoutGraceMinutes(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 30;
  }
  const rounded = Math.trunc(value);
  return Math.max(5, Math.min(720, rounded));
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

function normalizeIdentityOcrDecisionMode(value: unknown): IdentityOcrDecisionMode {
  if (typeof value !== "string") {
    return "assist";
  }
  return value.trim().toLowerCase() === "strict" ? "strict" : "assist";
}

function normalizeIdentityDocumentType(value: string): string | null {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_-]/g, "");
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, 40);
}

function normalizeAllowedDocumentTypes(value: unknown): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  const deduped = new Set<string>();
  for (const item of source) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = normalizeIdentityDocumentType(item);
    if (!normalized) {
      continue;
    }
    deduped.add(normalized);
    if (deduped.size >= 10) {
      break;
    }
  }

  const values = Array.from(deduped);
  return values.length > 0
    ? values
    : [...DEFAULT_IDENTITY_CONFIG.allowedDocumentTypes];
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
      identity: { ...DEFAULT_IDENTITY_CONFIG },
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
  const rawIdentity =
    objectInput.identity && typeof objectInput.identity === "object"
      ? (objectInput.identity as Record<string, unknown>)
      : {};

  const endpointUrl = normalizeUrl(rawHardware.endpointUrl);
  const provider = normalizeString(rawHardware.provider, 80);

  return {
    version: 1,
    geofence: {
      mode: normalizeMode(rawGeofence.mode),
      allowMissingLocation: rawGeofence.allowMissingLocation !== false,
      overrideCodeHash: normalizeOverrideCodeHash(rawGeofence.overrideCodeHash),
      automationMode: normalizeAutomationMode(rawGeofence.automationMode),
      autoCheckoutGraceMinutes: normalizeAutoCheckoutGraceMinutes(
        rawGeofence.autoCheckoutGraceMinutes,
      ),
      updatedAt: normalizeIsoTimestamp(rawGeofence.updatedAt),
    },
    hardware: {
      enabled: rawHardware.enabled === true && endpointUrl !== null,
      provider,
      endpointUrl,
      authToken: normalizeString(rawHardware.authToken, 512),
      updatedAt: normalizeIsoTimestamp(rawHardware.updatedAt),
    },
    identity: {
      enabled: rawIdentity.enabled === true,
      requirePhoto: rawIdentity.requirePhoto === true,
      requireIdScan: rawIdentity.requireIdScan === true,
      requireConsent: rawIdentity.requireConsent !== false,
      requireOcrVerification:
        rawIdentity.enabled === true &&
        rawIdentity.requireIdScan === true &&
        rawIdentity.requireOcrVerification === true,
      allowedDocumentTypes: normalizeAllowedDocumentTypes(
        rawIdentity.allowedDocumentTypes,
      ),
      ocrDecisionMode: normalizeIdentityOcrDecisionMode(
        rawIdentity.ocrDecisionMode,
      ),
      updatedAt: normalizeIsoTimestamp(rawIdentity.updatedAt),
    },
  };
}

export function buildAccessControlConfig(input: {
  geofenceMode: GeofenceEnforcementMode;
  geofenceAllowMissingLocation: boolean;
  geofenceOverrideCode?: string | null;
  clearGeofenceOverrideCode?: boolean;
  geofenceAutomationMode: GeofenceAutomationMode;
  geofenceAutoCheckoutGraceMinutes: number;
  hardwareEnabled: boolean;
  hardwareProvider?: string | null;
  hardwareEndpointUrl?: string | null;
  hardwareAuthToken?: string | null;
  clearHardwareAuthToken?: boolean;
  identityEnabled?: boolean;
  identityRequirePhoto?: boolean;
  identityRequireIdScan?: boolean;
  identityRequireConsent?: boolean;
  identityRequireOcrVerification?: boolean;
  identityAllowedDocumentTypes?: string[] | string | null;
  identityOcrDecisionMode?: IdentityOcrDecisionMode | null;
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
  const identityEnabled = input.identityEnabled === true;
  const identityRequirePhoto = identityEnabled && input.identityRequirePhoto === true;
  const identityRequireIdScan = identityEnabled && input.identityRequireIdScan === true;
  const identityRequireOcrVerification =
    identityEnabled &&
    identityRequireIdScan &&
    input.identityRequireOcrVerification === true;
  const identityAllowedDocumentTypes = normalizeAllowedDocumentTypes(
    input.identityAllowedDocumentTypes ?? existing.identity.allowedDocumentTypes,
  );
  const identityOcrDecisionMode = normalizeIdentityOcrDecisionMode(
    input.identityOcrDecisionMode ?? existing.identity.ocrDecisionMode,
  );

  return {
    version: 1,
    geofence: {
      mode: input.geofenceMode,
      allowMissingLocation: input.geofenceAllowMissingLocation,
      overrideCodeHash: nextOverrideCodeHash,
      automationMode: input.geofenceAutomationMode,
      autoCheckoutGraceMinutes: normalizeAutoCheckoutGraceMinutes(
        input.geofenceAutoCheckoutGraceMinutes,
      ),
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
    identity: {
      enabled: identityEnabled,
      requirePhoto: identityRequirePhoto,
      requireIdScan: identityRequireIdScan,
      requireConsent:
        identityEnabled ? input.identityRequireConsent !== false : true,
      requireOcrVerification: identityRequireOcrVerification,
      allowedDocumentTypes: identityAllowedDocumentTypes,
      ocrDecisionMode: identityOcrDecisionMode,
      updatedAt: identityEnabled ? nowIso : existing.identity.updatedAt,
    },
  };
}

export function hasHardwareAccessTarget(config: AccessControlConfig): boolean {
  return config.hardware.enabled && config.hardware.endpointUrl !== null;
}
