import type { AccessConnectorProvider, Prisma } from "@prisma/client";
import {
  hasHardwareAccessTarget,
  parseAccessControlConfig,
} from "@/lib/access-control/config";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { GUARDRAILS } from "@/lib/guardrails";
import {
  EntitlementDeniedError,
  assertCompanyFeatureEnabled,
} from "@/lib/plans";
import {
  createAccessConnectorHealthEvent,
  findActiveAccessConnectorConfig,
} from "@/lib/repository/access-connector.repository";
import {
  countOutboundWebhookDeliveriesSince,
  queueOutboundWebhookDeliveries,
} from "@/lib/repository/webhook-delivery.repository";
import { resolveAccessConnectorProvider } from "./providers";
import type { AccessConnectorCommand } from "./providers/base";

export interface DispatchAccessConnectorCommandInput {
  companyId: string;
  siteId: string;
  siteName: string;
  accessControl: unknown;
  correlationId: string;
  command: AccessConnectorCommand;
  reason: string;
  signInRecordId?: string;
  visitorName?: string;
  visitorPhoneE164?: string;
  metadata?: Record<string, unknown>;
}

export interface DispatchAccessConnectorCommandResult {
  queued: boolean;
  mode: "none" | "generic" | "provider";
  provider: AccessConnectorProvider | null;
  reason: string;
  targetUrl: string | null;
  controlId?: string;
}

function toLast4(phone: string | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length === 0) return null;
  return digits.length <= 4 ? digits : digits.slice(-4);
}

function dayStartUtc(date = new Date()): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

function toProvider(value: string | null | undefined): AccessConnectorProvider {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (normalized === "HID_ORIGO") return "HID_ORIGO";
  if (normalized === "BRIVO") return "BRIVO";
  if (normalized === "GALLAGHER") return "GALLAGHER";
  if (normalized === "LENELS2") return "LENELS2";
  if (normalized === "GENETEC") return "GENETEC";
  return "GENERIC";
}

export async function dispatchAccessConnectorCommand(
  input: DispatchAccessConnectorCommandInput,
): Promise<DispatchAccessConnectorCommandResult> {
  const accessConfig = parseAccessControlConfig(input.accessControl);
  if (!hasHardwareAccessTarget(accessConfig)) {
    return {
      queued: false,
      mode: "none",
      provider: null,
      reason: "hardware_target_missing",
      targetUrl: null,
    };
  }

  const deliveryCap = Math.max(
    0,
    GUARDRAILS.MAX_CONNECTOR_DELIVERIES_PER_COMPANY_PER_DAY,
  );
  if (deliveryCap > 0) {
    const usedToday = await countOutboundWebhookDeliveriesSince(input.companyId, {
      since: dayStartUtc(),
      eventType: "hardware.access.decision",
    });
    if (usedToday >= deliveryCap) {
      return {
        queued: false,
        mode: "none",
        provider: null,
        reason: "connector_delivery_cap_reached",
        targetUrl: null,
        controlId: "CONNECTOR-GUARDRAIL-001",
      };
    }
  }

  const provider = toProvider(accessConfig.hardware.provider);
  const visitorPhoneLast4 = toLast4(input.visitorPhoneE164);

  const queueDelivery = async (params: {
    provider: AccessConnectorProvider;
    targetUrl: string;
    mode: "generic" | "provider";
    reason: string;
    connectorConfigId?: string | null;
  }): Promise<DispatchAccessConnectorCommandResult> => {
    const providerRuntime = resolveAccessConnectorProvider(params.provider);
    const payload = providerRuntime.buildPayload({
      correlationId: input.correlationId,
      command: input.command,
      reason: input.reason,
      siteId: input.siteId,
      siteName: input.siteName,
      signInRecordId: input.signInRecordId,
      visitorName: input.visitorName,
      visitorPhoneLast4,
      metadata: {
        ...(input.metadata ?? {}),
        connector_mode: params.mode,
        connector_provider: params.provider,
        connector_config_id: params.connectorConfigId ?? null,
      },
    });

    const queuedCount = await queueOutboundWebhookDeliveries(input.companyId, [
      {
        siteId: input.siteId,
        eventType: "hardware.access.decision",
        targetUrl: params.targetUrl,
        payload: payload as Prisma.InputJsonValue,
      },
    ]);

    return {
      queued: queuedCount > 0,
      mode: params.mode,
      provider: params.provider,
      reason: params.reason,
      targetUrl: params.targetUrl,
    };
  };

  if (provider !== "GENERIC" && isFeatureEnabled("ACCESS_CONNECTORS_V1")) {
    let providerEntitled = false;
    try {
      await assertCompanyFeatureEnabled(
        input.companyId,
        "ACCESS_CONNECTORS_V1",
        input.siteId,
      );
      providerEntitled = true;
    } catch (error) {
      if (!(error instanceof EntitlementDeniedError)) {
        throw error;
      }
    }

    if (providerEntitled) {
      const connectorConfig = await findActiveAccessConnectorConfig(input.companyId, {
        provider,
        site_id: input.siteId,
      });

      if (connectorConfig) {
        try {
          const queued = await queueDelivery({
            provider,
            targetUrl: connectorConfig.endpoint_url,
            mode: "provider",
            reason: "provider_connector_queued",
            connectorConfigId: connectorConfig.id,
          });

          if (queued.queued) {
            await createAccessConnectorHealthEvent(input.companyId, {
              site_id: input.siteId,
              connector_config_id: connectorConfig.id,
              provider,
              status: "HEALTHY",
              reason: "dispatch_queued",
              details: {
                correlation_id: input.correlationId,
                command: input.command,
              },
            });
          }

          return queued;
        } catch (error) {
          await createAccessConnectorHealthEvent(input.companyId, {
            site_id: input.siteId,
            connector_config_id: connectorConfig.id,
            provider,
            status: "OUTAGE",
            reason: "dispatch_failed",
            details: {
              correlation_id: input.correlationId,
              command: input.command,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      } else {
        await createAccessConnectorHealthEvent(input.companyId, {
          site_id: input.siteId,
          connector_config_id: null,
          provider,
          status: "DEGRADED",
          reason: "provider_config_missing",
          details: {
            correlation_id: input.correlationId,
            command: input.command,
          },
        });
      }
    }
  }

  const genericQueued = await queueDelivery({
    provider: "GENERIC",
    targetUrl: accessConfig.hardware.endpointUrl!,
    mode: "generic",
    reason: "generic_connector_queued",
  });

  return genericQueued;
}
