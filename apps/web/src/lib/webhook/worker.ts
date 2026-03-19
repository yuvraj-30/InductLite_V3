import { createHmac } from "crypto";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import { scopedDb } from "@/lib/db/scoped-db";
import {
  claimOutboundWebhookDelivery,
  listDueOutboundWebhookDeliveries,
  markOutboundWebhookDeliveryRetriableFailure,
  markOutboundWebhookDeliverySent,
} from "@/lib/repository/webhook-delivery.repository";
import { parseWebhookConfig } from "./config";
import { parseLmsConnectorConfig } from "@/lib/lms/config";
import { parseAccessControlConfig } from "@/lib/access-control/config";
import { parseProcoreConnectorConfig } from "@/lib/integrations/procore/config";
import { decryptNullableString } from "@/lib/security/data-protection";

const WEBHOOK_BATCH_SIZE = 50;
const WEBHOOK_TIMEOUT_MS = 12_000;
const MAX_LOGGED_RESPONSE_BODY_CHARS = 2_000;
const MAX_LOGGED_ERROR_CHARS = 800;
const MAX_BACKOFF_SECONDS = 3_600;

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function computeBackoffSeconds(nextAttemptNumber: number): number {
  const candidate = 30 * 2 ** Math.max(nextAttemptNumber - 1, 0);
  return Math.min(candidate, MAX_BACKOFF_SECONDS);
}

function buildWebhookSignature(input: {
  signingSecret: string;
  timestamp: string;
  body: string;
}): string {
  const digest = createHmac("sha256", input.signingSecret)
    .update(`${input.timestamp}.${input.body}`)
    .digest("hex");
  return `sha256=${digest}`;
}

function getFetchTimeoutSignal(timeoutMs: number): AbortSignal | undefined {
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }
  return undefined;
}

function readConnectorProviderFromPayload(
  payload: unknown,
): "HID_ORIGO" | "BRIVO" | "GALLAGHER" | "LENELS2" | "GENETEC" | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const provider = (payload as Record<string, unknown>).provider;
  if (typeof provider !== "string") {
    return null;
  }
  const normalized = provider.trim().toUpperCase();
  if (
    normalized === "HID_ORIGO" ||
    normalized === "BRIVO" ||
    normalized === "GALLAGHER" ||
    normalized === "LENELS2" ||
    normalized === "GENETEC"
  ) {
    return normalized;
  }
  return null;
}

export interface OutboundWebhookProcessingSummary {
  candidates: number;
  claimed: number;
  sent: number;
  retried: number;
  deadLettered: number;
}

export async function processOutboundWebhookQueue(
  now: Date = new Date(),
): Promise<OutboundWebhookProcessingSummary> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);
  const defaultSigningSecret = process.env.WEBHOOK_SIGNING_SECRET?.trim() ?? "";
  const deliveryConfigBySite = new Map<
    string,
    {
      signingSecret: string;
      lmsAuthToken: string | null;
      lmsProvider: string | null;
      procoreAuthToken: string | null;
      procoreProjectId: string | null;
      hardwareAuthToken: string | null;
      hardwareProvider: string | null;
    }
  >();
  const connectorTokenCache = new Map<string, string | null>();

  const summary: OutboundWebhookProcessingSummary = {
    candidates: 0,
    claimed: 0,
    sent: 0,
    retried: 0,
    deadLettered: 0,
  };

  const deliveries = await listDueOutboundWebhookDeliveries(now, WEBHOOK_BATCH_SIZE);
  summary.candidates = deliveries.length;

  const resolveDeliveryConfigForSite = async (delivery: {
    company_id: string;
    site_id: string;
  }): Promise<{
    signingSecret: string;
    lmsAuthToken: string | null;
    lmsProvider: string | null;
    procoreAuthToken: string | null;
    procoreProjectId: string | null;
    hardwareAuthToken: string | null;
    hardwareProvider: string | null;
  }> => {
    const cacheKey = `${delivery.company_id}:${delivery.site_id}`;
    const cached = deliveryConfigBySite.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const site = await scopedDb(delivery.company_id).site.findFirst({
      where: {
        id: delivery.site_id,
        company_id: delivery.company_id,
      },
      select: {
        webhooks: true,
        lms_connector: true,
        access_control: true,
      },
    });

    const webhookConfig = parseWebhookConfig(site?.webhooks);
    const lmsConfig = parseLmsConnectorConfig(site?.lms_connector);
    const procoreConfig = parseProcoreConnectorConfig(site?.lms_connector);
    const accessControlConfig = parseAccessControlConfig(site?.access_control);
    const resolvedConfig = {
      signingSecret: webhookConfig.signingSecret ?? defaultSigningSecret,
      lmsAuthToken: lmsConfig.authToken,
      lmsProvider: lmsConfig.provider,
      procoreAuthToken: procoreConfig.authToken,
      procoreProjectId: procoreConfig.projectId,
      hardwareAuthToken: accessControlConfig.hardware.authToken,
      hardwareProvider: accessControlConfig.hardware.provider,
    };

    deliveryConfigBySite.set(cacheKey, resolvedConfig);
    return resolvedConfig;
  };

  for (const delivery of deliveries) {
    const claimed = await claimOutboundWebhookDelivery(delivery.id);
    if (!claimed) {
      continue;
    }

    summary.claimed += 1;

    const attemptNumber = delivery.attempts + 1;
    const timestamp = now.toISOString();
    const body = JSON.stringify(delivery.payload);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-InductLite-Event": delivery.event_type,
      "X-InductLite-Delivery-Id": delivery.id,
      "X-InductLite-Attempt": String(attemptNumber),
      "X-InductLite-Timestamp": timestamp,
    };

    const deliveryConfig = await resolveDeliveryConfigForSite(delivery);
    const signingSecret = deliveryConfig.signingSecret;
    if (signingSecret.length > 0) {
      headers["X-InductLite-Signature"] = buildWebhookSignature({
        signingSecret,
        timestamp,
        body,
      });
    }

    if (
      delivery.event_type === "lms.completion" &&
      deliveryConfig.lmsAuthToken
    ) {
      headers.Authorization = `Bearer ${deliveryConfig.lmsAuthToken}`;
      if (deliveryConfig.lmsProvider) {
        headers["X-InductLite-Lms-Provider"] = deliveryConfig.lmsProvider;
      }
    }

    if (
      delivery.event_type === "hardware.access.decision" &&
      deliveryConfig.hardwareAuthToken
    ) {
      headers.Authorization = `Bearer ${deliveryConfig.hardwareAuthToken}`;
      if (deliveryConfig.hardwareProvider) {
        headers["X-InductLite-Hardware-Provider"] =
          deliveryConfig.hardwareProvider;
      }
    }

    const connectorProvider = readConnectorProviderFromPayload(delivery.payload);
    if (
      delivery.event_type === "hardware.access.decision" &&
      connectorProvider
    ) {
      const tokenCacheKey = `${delivery.company_id}:${delivery.site_id}:${connectorProvider}`;
      let connectorToken = connectorTokenCache.get(tokenCacheKey);
      if (connectorToken === undefined) {
        const connectorConfig = await scopedDb(
          delivery.company_id,
        ).accessConnectorConfig.findFirst({
          where: {
            company_id: delivery.company_id,
            site_id: delivery.site_id,
            provider: connectorProvider,
            is_active: true,
          },
          select: {
            auth_token_encrypted: true,
          },
        });
        connectorToken = decryptNullableString(
          connectorConfig?.auth_token_encrypted ?? null,
        );
        connectorTokenCache.set(tokenCacheKey, connectorToken ?? null);
      }

      if (connectorToken) {
        headers.Authorization = `Bearer ${connectorToken}`;
      }
      headers["X-InductLite-Hardware-Provider"] = connectorProvider;
    }

    if (
      delivery.event_type.startsWith("procore.") &&
      deliveryConfig.procoreAuthToken
    ) {
      headers.Authorization = `Bearer ${deliveryConfig.procoreAuthToken}`;
      headers["X-InductLite-Connector"] = "PROCORE";
      if (deliveryConfig.procoreProjectId) {
        headers["X-InductLite-Procore-Project"] =
          deliveryConfig.procoreProjectId;
      }
    }

    try {
      const response = await fetch(delivery.target_url, {
        method: "POST",
        headers,
        body,
        signal: getFetchTimeoutSignal(WEBHOOK_TIMEOUT_MS),
      });
      const responseBodyText = truncateText(
        await response.text().catch(() => ""),
        MAX_LOGGED_RESPONSE_BODY_CHARS,
      );

      if (response.ok) {
        await markOutboundWebhookDeliverySent({
          id: delivery.id,
          statusCode: response.status,
          responseBody: responseBodyText || null,
        });
        summary.sent += 1;
        continue;
      }

      const dead = attemptNumber >= delivery.max_attempts;
      const nextAttemptAt = new Date(
        now.getTime() + computeBackoffSeconds(attemptNumber) * 1000,
      );

      await markOutboundWebhookDeliveryRetriableFailure({
        id: delivery.id,
        statusCode: response.status,
        errorMessage: `HTTP ${response.status}`,
        responseBody: responseBodyText || null,
        nextAttemptAt,
        dead,
      });

      if (dead) {
        summary.deadLettered += 1;
      } else {
        summary.retried += 1;
      }
    } catch (error) {
      const dead = attemptNumber >= delivery.max_attempts;
      const nextAttemptAt = new Date(
        now.getTime() + computeBackoffSeconds(attemptNumber) * 1000,
      );

      await markOutboundWebhookDeliveryRetriableFailure({
        id: delivery.id,
        errorMessage: truncateText(String(error), MAX_LOGGED_ERROR_CHARS),
        nextAttemptAt,
        dead,
      });

      if (dead) {
        summary.deadLettered += 1;
      } else {
        summary.retried += 1;
      }
    }
  }

  log.info(
    {
      requestId,
      ...summary,
      default_signing_enabled: defaultSigningSecret.length > 0,
    },
    "Processed outbound webhook queue",
  );

  return summary;
}
