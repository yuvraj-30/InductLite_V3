import { createHash, randomBytes } from "crypto";

export const WEBHOOK_EVENT_TYPES = ["induction.completed"] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export interface WebhookEndpointConfig {
  id: string;
  url: string;
  enabled: boolean;
  events: WebhookEventType[];
  createdAt: string;
  updatedAt: string;
}

export interface WebhookConfig {
  version: 2;
  endpoints: WebhookEndpointConfig[];
  signingSecret: string | null;
  signingSecretUpdatedAt: string | null;
}

function normalizeEventType(value: unknown): WebhookEventType | null {
  if (typeof value !== "string") {
    return null;
  }

  return WEBHOOK_EVENT_TYPES.includes(value as WebhookEventType)
    ? (value as WebhookEventType)
    : null;
}

function normalizeEndpointUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function createEndpointId(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

function normalizeEndpointId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEndpointEntry(
  entry: unknown,
  fallbackEvents: WebhookEventType[],
  nowIso: string,
): WebhookEndpointConfig | null {
  let endpointIdValue: unknown;
  let urlValue: unknown;
  let enabledValue: unknown = true;
  let eventsValue: unknown = fallbackEvents;
  let createdAtValue: unknown = nowIso;
  let updatedAtValue: unknown = nowIso;

  if (typeof entry === "string") {
    urlValue = entry;
  } else if (entry && typeof entry === "object") {
    const objectEntry = entry as Record<string, unknown>;
    endpointIdValue = objectEntry.id;
    urlValue = objectEntry.url;
    enabledValue = objectEntry.enabled ?? true;
    eventsValue = objectEntry.events ?? fallbackEvents;
    createdAtValue = objectEntry.createdAt ?? nowIso;
    updatedAtValue = objectEntry.updatedAt ?? nowIso;
  } else {
    return null;
  }

  const normalizedUrl = normalizeEndpointUrl(urlValue);
  if (!normalizedUrl) {
    return null;
  }

  const normalizedEventsSet = new Set<WebhookEventType>();
  if (Array.isArray(eventsValue)) {
    for (const eventValue of eventsValue) {
      const eventType = normalizeEventType(eventValue);
      if (eventType) {
        normalizedEventsSet.add(eventType);
      }
    }
  } else {
    const eventType = normalizeEventType(eventsValue);
    if (eventType) {
      normalizedEventsSet.add(eventType);
    }
  }

  if (normalizedEventsSet.size === 0) {
    fallbackEvents.forEach((eventType) => normalizedEventsSet.add(eventType));
  }

  const createdAt =
    typeof createdAtValue === "string" && !Number.isNaN(Date.parse(createdAtValue))
      ? new Date(createdAtValue).toISOString()
      : nowIso;
  const updatedAt =
    typeof updatedAtValue === "string" && !Number.isNaN(Date.parse(updatedAtValue))
      ? new Date(updatedAtValue).toISOString()
      : nowIso;

  return {
    id: normalizeEndpointId(endpointIdValue) ?? createEndpointId(normalizedUrl),
    url: normalizedUrl,
    enabled: enabledValue !== false,
    events: [...normalizedEventsSet],
    createdAt,
    updatedAt,
  };
}

function normalizeSigningSecret(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length < 16) {
    return null;
  }

  return trimmed;
}

export function parseWebhookConfig(
  input: unknown,
  options?: {
    defaultEvents?: WebhookEventType[];
  },
): WebhookConfig {
  const nowIso = new Date().toISOString();
  const defaultEvents = options?.defaultEvents ?? ["induction.completed"];
  const dedupedByUrl = new Map<string, WebhookEndpointConfig>();

  let rawEndpoints: unknown[] = [];
  let signingSecretValue: unknown;
  let signingSecretUpdatedAtValue: unknown;

  if (Array.isArray(input)) {
    rawEndpoints = input;
  } else if (input && typeof input === "object") {
    const objectInput = input as Record<string, unknown>;
    if (Array.isArray(objectInput.endpoints)) {
      rawEndpoints = objectInput.endpoints;
    } else if (Array.isArray(objectInput.webhooks)) {
      rawEndpoints = objectInput.webhooks;
    } else {
      rawEndpoints = [];
    }

    signingSecretValue = objectInput.signingSecret;
    signingSecretUpdatedAtValue = objectInput.signingSecretUpdatedAt;
  }

  for (const endpointEntry of rawEndpoints) {
    const endpoint = normalizeEndpointEntry(endpointEntry, defaultEvents, nowIso);
    if (!endpoint) {
      continue;
    }
    dedupedByUrl.set(endpoint.url, endpoint);
  }

  const signingSecret = normalizeSigningSecret(signingSecretValue);
  const signingSecretUpdatedAt =
    signingSecret &&
    typeof signingSecretUpdatedAtValue === "string" &&
    !Number.isNaN(Date.parse(signingSecretUpdatedAtValue))
      ? new Date(signingSecretUpdatedAtValue).toISOString()
      : signingSecret
        ? nowIso
        : null;

  return {
    version: 2,
    endpoints: [...dedupedByUrl.values()],
    signingSecret,
    signingSecretUpdatedAt,
  };
}

export function buildWebhookConfigFromUrls(input: {
  urls: string[];
  signingSecret?: string | null;
  existingConfig?: WebhookConfig | null;
  defaultEvents?: WebhookEventType[];
}): WebhookConfig {
  const nowIso = new Date().toISOString();
  const defaultEvents = input.defaultEvents ?? ["induction.completed"];
  const existingByUrl = new Map(
    (input.existingConfig?.endpoints ?? []).map((endpoint) => [endpoint.url, endpoint]),
  );
  const dedupedUrls = new Set<string>();
  const endpoints: WebhookEndpointConfig[] = [];

  for (const candidateUrl of input.urls) {
    const normalizedUrl = normalizeEndpointUrl(candidateUrl);
    if (!normalizedUrl || dedupedUrls.has(normalizedUrl)) {
      continue;
    }
    dedupedUrls.add(normalizedUrl);

    const existing = existingByUrl.get(normalizedUrl);
    endpoints.push({
      id: existing?.id ?? createEndpointId(normalizedUrl),
      url: normalizedUrl,
      enabled: existing?.enabled ?? true,
      events: existing?.events?.length ? existing.events : defaultEvents,
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
    });
  }

  const normalizedSecret = normalizeSigningSecret(input.signingSecret ?? null);
  const previousSecret = input.existingConfig?.signingSecret ?? null;
  const secretChanged = normalizedSecret !== previousSecret;

  return {
    version: 2,
    endpoints,
    signingSecret: normalizedSecret,
    signingSecretUpdatedAt: normalizedSecret
      ? secretChanged
        ? nowIso
        : (input.existingConfig?.signingSecretUpdatedAt ?? nowIso)
      : null,
  };
}

export function rotateWebhookSigningSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function resolveWebhookTargetsForEvent(
  input: unknown,
  eventType: WebhookEventType,
): string[] {
  const config = parseWebhookConfig(input);
  return config.endpoints
    .filter(
      (endpoint) => endpoint.enabled && endpoint.events.includes(eventType),
    )
    .map((endpoint) => endpoint.url);
}
