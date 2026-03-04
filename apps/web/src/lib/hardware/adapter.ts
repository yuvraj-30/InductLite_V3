import {
  hasHardwareAccessTarget,
  parseAccessControlConfig,
} from "@/lib/access-control/config";
import type { Prisma } from "@prisma/client";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { queueOutboundWebhookDeliveries } from "@/lib/repository/webhook-delivery.repository";

export type HardwareAccessDecision = "ALLOW" | "DENY";

export interface QueueHardwareAccessDecisionInput {
  companyId: string;
  siteId: string;
  siteName: string;
  accessControl: unknown;
  decision: HardwareAccessDecision;
  reason: string;
  signInRecordId?: string;
  visitorName?: string;
  visitorPhoneE164?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface QueueHardwareAccessDecisionResult {
  queued: boolean;
  reason: string;
}

function maskToLast4(phone: string | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length === 0) {
    return null;
  }
  if (digits.length <= 4) {
    return digits;
  }
  return digits.slice(-4);
}

function buildHardwarePayload(input: {
  provider: string | null;
  decision: HardwareAccessDecision;
  reason: string;
  siteId: string;
  siteName: string;
  signInRecordId?: string;
  visitorName?: string;
  visitorPhoneE164?: string;
  metadata?: Record<string, unknown>;
}) {
  const providerKey = input.provider?.trim().toUpperCase() || "GENERIC";
  const occurredAt = new Date().toISOString();
  const maskedPhone = maskToLast4(input.visitorPhoneE164);

  const common = {
    event: "hardware.access.decision",
    provider: providerKey,
    occurredAt,
    decision: input.decision,
    reason: input.reason,
    site: {
      id: input.siteId,
      name: input.siteName,
    },
    subject: {
      signInRecordId: input.signInRecordId ?? null,
      visitorName: input.visitorName ?? null,
      visitorPhoneLast4: maskedPhone,
    },
    metadata: input.metadata ?? {},
  };

  if (providerKey === "HID_ORIGO") {
    return {
      ...common,
      hidOrigo: {
        command: input.decision === "ALLOW" ? "grant" : "deny",
      },
    };
  }

  if (providerKey === "SITE_GATEWAY") {
    return {
      ...common,
      siteGateway: {
        action: input.decision === "ALLOW" ? "open_gate" : "keep_closed",
      },
    };
  }

  return common;
}

export async function queueHardwareAccessDecision(
  input: QueueHardwareAccessDecisionInput,
): Promise<QueueHardwareAccessDecisionResult> {
  const config = parseAccessControlConfig(input.accessControl);
  if (!hasHardwareAccessTarget(config)) {
    return { queued: false, reason: "hardware_target_missing" };
  }

  try {
    await assertCompanyFeatureEnabled(
      input.companyId,
      "HARDWARE_ACCESS",
      input.siteId,
    );
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return { queued: false, reason: "hardware_entitlement_disabled" };
    }
    throw error;
  }

  try {
    const payload = buildHardwarePayload({
      provider: config.hardware.provider,
      decision: input.decision,
      reason: input.reason,
      siteId: input.siteId,
      siteName: input.siteName,
      signInRecordId: input.signInRecordId,
      visitorName: input.visitorName,
      visitorPhoneE164: input.visitorPhoneE164,
      metadata: input.metadata,
    });

    const queuedCount = await queueOutboundWebhookDeliveries(input.companyId, [
      {
        siteId: input.siteId,
        eventType: "hardware.access.decision",
        targetUrl: config.hardware.endpointUrl!,
        payload: payload as Prisma.InputJsonValue,
      },
    ]);

    if (queuedCount > 0) {
      await createAuditLog(input.companyId, {
        action: "hardware.access_queued",
        entity_type: "Site",
        entity_id: input.siteId,
        user_id: undefined,
        details: {
          decision: input.decision,
          reason: input.reason,
          provider: config.hardware.provider,
          endpoint_url: config.hardware.endpointUrl,
          sign_in_record_id: input.signInRecordId ?? null,
          visitor_phone_last4: maskToLast4(input.visitorPhoneE164),
        },
        request_id: input.requestId,
      });
    }

    return { queued: queuedCount > 0, reason: "queued" };
  } catch (error) {
    await createAuditLog(input.companyId, {
      action: "hardware.access_failed",
      entity_type: "Site",
      entity_id: input.siteId,
      user_id: undefined,
      details: {
        decision: input.decision,
        reason: input.reason,
        error: error instanceof Error ? error.message : String(error),
      },
      request_id: input.requestId,
    });

    return {
      queued: false,
      reason: "queue_failed",
    };
  }
}
