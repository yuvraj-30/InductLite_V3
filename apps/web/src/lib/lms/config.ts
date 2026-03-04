export interface LmsConnectorConfig {
  version: 1;
  enabled: boolean;
  provider: string | null;
  endpointUrl: string | null;
  authToken: string | null;
  courseCode: string | null;
  updatedAt: string | null;
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

function normalizeEndpointUrl(value: unknown): string | null {
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

export function parseLmsConnectorConfig(input: unknown): LmsConnectorConfig {
  const fallback: LmsConnectorConfig = {
    version: 1,
    enabled: false,
    provider: null,
    endpointUrl: null,
    authToken: null,
    courseCode: null,
    updatedAt: null,
  };

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fallback;
  }

  const value = input as Record<string, unknown>;
  const endpointUrl = normalizeEndpointUrl(value.endpointUrl);
  const provider = normalizeString(value.provider, 80);
  const authToken = normalizeString(value.authToken, 512);
  const courseCode = normalizeString(value.courseCode, 120);
  const updatedAt = normalizeIsoTimestamp(value.updatedAt);
  const enabled = value.enabled === true && endpointUrl !== null;

  return {
    version: 1,
    enabled,
    provider,
    endpointUrl,
    authToken,
    courseCode,
    updatedAt,
  };
}

export function buildLmsConnectorConfig(input: {
  enabled: boolean;
  endpointUrl?: string | null;
  authToken?: string | null;
  provider?: string | null;
  courseCode?: string | null;
  existingConfig?: LmsConnectorConfig | null;
}): LmsConnectorConfig {
  const endpointUrl = normalizeEndpointUrl(input.endpointUrl);
  const provider = normalizeString(input.provider, 80);
  const authToken = normalizeString(input.authToken, 512);
  const courseCode = normalizeString(input.courseCode, 120);
  const hasEndpoint = endpointUrl !== null;
  const enabled = input.enabled === true && hasEndpoint;

  return {
    version: 1,
    enabled,
    endpointUrl,
    authToken,
    provider,
    courseCode,
    updatedAt: enabled
      ? new Date().toISOString()
      : input.existingConfig?.updatedAt ?? null,
  };
}

export function hasLmsConnectorTarget(config: LmsConnectorConfig): boolean {
  return config.enabled && config.endpointUrl !== null;
}

