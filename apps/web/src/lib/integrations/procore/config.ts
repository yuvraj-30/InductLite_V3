export interface ProcoreConnectorConfig {
  version: 1;
  provider: "PROCORE";
  enabled: boolean;
  endpointUrl: string | null;
  authToken: string | null;
  inboundSharedSecret: string | null;
  projectId: string | null;
  includeSignInEvents: boolean;
  includePermitEvents: boolean;
  updatedAt: string | null;
}

function clean(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function cleanUrl(value: unknown): string | null {
  const trimmed = clean(value, 2048);
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function cleanIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function parseProcoreConnectorConfig(value: unknown): ProcoreConnectorConfig {
  const fallback: ProcoreConnectorConfig = {
    version: 1,
    provider: "PROCORE",
    enabled: false,
    endpointUrl: null,
    authToken: null,
    inboundSharedSecret: null,
    projectId: null,
    includeSignInEvents: true,
    includePermitEvents: true,
    updatedAt: null,
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const provider = clean(record.provider, 40)?.toUpperCase();
  if (provider !== "PROCORE") {
    return fallback;
  }

  const endpointUrl = cleanUrl(record.endpointUrl);
  const enabled = record.enabled === true && endpointUrl !== null;
  return {
    version: 1,
    provider: "PROCORE",
    enabled,
    endpointUrl,
    authToken: clean(record.authToken, 512),
    inboundSharedSecret: clean(record.inboundSharedSecret, 512),
    projectId: clean(record.projectId, 120),
    includeSignInEvents: record.includeSignInEvents !== false,
    includePermitEvents: record.includePermitEvents !== false,
    updatedAt: cleanIsoDate(record.updatedAt),
  };
}

export function buildProcoreConnectorConfig(input: {
  enabled: boolean;
  endpointUrl?: string | null;
  authToken?: string | null;
  inboundSharedSecret?: string | null;
  projectId?: string | null;
  includeSignInEvents?: boolean;
  includePermitEvents?: boolean;
  existingConfig?: ProcoreConnectorConfig | null;
}): ProcoreConnectorConfig {
  const endpointUrl = cleanUrl(input.endpointUrl);
  const enabled = input.enabled === true && endpointUrl !== null;
  return {
    version: 1,
    provider: "PROCORE",
    enabled,
    endpointUrl,
    authToken: clean(input.authToken, 512),
    inboundSharedSecret: clean(input.inboundSharedSecret, 512),
    projectId: clean(input.projectId, 120),
    includeSignInEvents: input.includeSignInEvents !== false,
    includePermitEvents: input.includePermitEvents !== false,
    updatedAt: enabled
      ? new Date().toISOString()
      : input.existingConfig?.updatedAt ?? null,
  };
}

export function hasProcoreConnectorTarget(config: ProcoreConnectorConfig): boolean {
  return config.enabled && config.endpointUrl !== null;
}
