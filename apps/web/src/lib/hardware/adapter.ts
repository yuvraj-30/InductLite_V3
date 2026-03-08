import {
  hasHardwareAccessTarget,
  parseAccessControlConfig,
} from "@/lib/access-control/config";
import { randomUUID } from "crypto";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { createAuditLog } from "@/lib/repository/audit.repository";
import {
  createAccessDecisionTrace,
  createHardwareOutageEvent,
} from "@/lib/repository/hardware-trace.repository";
import { dispatchAccessConnectorCommand } from "@/lib/access-connectors";

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

export async function queueHardwareAccessDecision(
  input: QueueHardwareAccessDecisionInput,
): Promise<QueueHardwareAccessDecisionResult> {
  const config = parseAccessControlConfig(input.accessControl);
  const correlationId = randomUUID();
  if (!hasHardwareAccessTarget(config)) {
    await createAccessDecisionTrace(input.companyId, {
      site_id: input.siteId,
      correlation_id: correlationId,
      decision_status: "FALLBACK",
      reason: "hardware_target_missing",
      sign_in_record_id: input.signInRecordId,
      fallback_mode: true,
      request_payload: {
        decision: input.decision,
        reason: input.reason,
      },
    });
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
      await createAccessDecisionTrace(input.companyId, {
        site_id: input.siteId,
        correlation_id: correlationId,
        decision_status: "FALLBACK",
        reason: "hardware_entitlement_disabled",
        sign_in_record_id: input.signInRecordId,
        fallback_mode: true,
        request_payload: {
          decision: input.decision,
          reason: input.reason,
        },
      });
      return { queued: false, reason: "hardware_entitlement_disabled" };
    }
    throw error;
  }

  try {
    const dispatch = await dispatchAccessConnectorCommand({
      companyId: input.companyId,
      siteId: input.siteId,
      siteName: input.siteName,
      accessControl: input.accessControl,
      correlationId,
      command: input.decision === "ALLOW" ? "grant" : "deny",
      reason: input.reason,
      signInRecordId: input.signInRecordId,
      visitorName: input.visitorName,
      visitorPhoneE164: input.visitorPhoneE164,
      metadata: input.metadata,
    });

    if (dispatch.reason === "connector_delivery_cap_reached") {
      await createAccessDecisionTrace(input.companyId, {
        site_id: input.siteId,
        correlation_id: correlationId,
        decision_status: "FALLBACK",
        reason: "connector_delivery_cap_reached",
        sign_in_record_id: input.signInRecordId,
        fallback_mode: true,
        request_payload: {
          decision: input.decision,
          reason: input.reason,
          provider: config.hardware.provider,
        },
        response_payload: {
          control_id: dispatch.controlId ?? "CONNECTOR-GUARDRAIL-001",
        },
      });
      return { queued: false, reason: "connector_delivery_cap_reached" };
    }

    if (dispatch.queued) {
      await createAccessDecisionTrace(input.companyId, {
        site_id: input.siteId,
        correlation_id: correlationId,
        decision_status: input.decision,
        reason: input.reason,
        sign_in_record_id: input.signInRecordId,
        decided_at: new Date(),
        request_payload: {
          decision: input.decision,
          reason: input.reason,
          provider: config.hardware.provider,
        },
        response_payload: {
          mode: dispatch.mode,
          provider: dispatch.provider,
          target_url: dispatch.targetUrl,
        },
      });

      await createAuditLog(input.companyId, {
        action: "hardware.access_queued",
        entity_type: "Site",
        entity_id: input.siteId,
        user_id: undefined,
        details: {
          decision: input.decision,
          reason: input.reason,
          provider: dispatch.provider ?? config.hardware.provider,
          connector_mode: dispatch.mode,
          endpoint_url: dispatch.targetUrl ?? config.hardware.endpointUrl,
          correlation_id: correlationId,
          sign_in_record_id: input.signInRecordId ?? null,
          visitor_phone_last4: maskToLast4(input.visitorPhoneE164),
        },
        request_id: input.requestId,
      });
    }

    return { queued: dispatch.queued, reason: dispatch.reason };
  } catch (error) {
    await createAccessDecisionTrace(input.companyId, {
      site_id: input.siteId,
      correlation_id: correlationId,
      decision_status: "ERROR",
      reason: "queue_failed",
      sign_in_record_id: input.signInRecordId,
      fallback_mode: true,
      request_payload: {
        decision: input.decision,
        reason: input.reason,
        provider: config.hardware.provider,
      },
      response_payload: {
        error: error instanceof Error ? error.message : String(error),
      },
    });

    await createHardwareOutageEvent(input.companyId, {
      site_id: input.siteId,
      provider: config.hardware.provider ?? undefined,
      severity: "DEGRADED",
      reason: "Hardware delivery queue failure",
      details: {
        correlation_id: correlationId,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    await createAuditLog(input.companyId, {
      action: "hardware.access_failed",
      entity_type: "Site",
      entity_id: input.siteId,
      user_id: undefined,
      details: {
        decision: input.decision,
        reason: input.reason,
        correlation_id: correlationId,
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
