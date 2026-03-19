import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findActiveChannelIntegrationConfig } from "@/lib/db/scoped";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { checkChannelActionRateLimit } from "@/lib/rate-limit";
import { getStableClientKey } from "@/lib/rate-limit/clientKey";
import {
  createChannelDelivery,
  createCommunicationEvent,
  markChannelDeliveryStatus,
} from "@/lib/repository/communication.repository";
import { transitionVisitorApprovalRequest } from "@/lib/repository/visitor-approval.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { getClientIpFromHeaders, getUserAgentFromHeaders } from "@/lib/auth/csrf";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";

const channelActionSchema = z.object({
  integrationConfigId: z.string().cuid(),
  actionId: z.string().min(8).max(200),
  approvalRequestId: z.string().cuid(),
  decision: z.enum(["APPROVED", "DENIED", "REVOKED"]),
  notes: z.string().max(1000).optional(),
});

const DEFAULT_CHANNEL_TIMESTAMP_TOLERANCE_SECONDS = 300;

function normalizeSignature(signatureHeader: string): string {
  const trimmed = signatureHeader.trim();
  if (trimmed.startsWith("sha256=")) {
    return trimmed.slice("sha256=".length);
  }
  return trimmed;
}

function verifyHmacSignature(input: {
  payload: string;
  secret: string;
  signatureHeader: string;
  timestamp: string;
}): boolean {
  const expected = createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.payload}`)
    .digest("hex");
  const provided = normalizeSignature(input.signatureHeader);

  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(provided, "hex");
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function parseSignedTimestamp(rawTimestamp: string): number | null {
  const trimmed = rawTimestamp.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) return null;
    return trimmed.length > 10 ? numeric : numeric * 1000;
  }

  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function isTimestampWithinTolerance(
  rawTimestamp: string,
  toleranceSeconds: number,
  nowMs = Date.now(),
): boolean {
  const timestampMs = parseSignedTimestamp(rawTimestamp);
  if (timestampMs === null) return false;
  return Math.abs(nowMs - timestampMs) <= toleranceSeconds * 1000;
}

export async function POST(request: NextRequest) {
  if (!isFeatureEnabled("TEAMS_SLACK_V1")) {
    return NextResponse.json(
      {
        success: false,
        error: "Channel actions are disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001)",
      },
      { status: 403 },
    );
  }

  const rawBody = await request.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = channelActionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 },
    );
  }

  const config = await findActiveChannelIntegrationConfig(
    parsed.data.integrationConfigId,
  );
  if (!config) {
    return NextResponse.json(
      { success: false, error: "Integration config not found or inactive" },
      { status: 404 },
    );
  }

  try {
    await assertCompanyFeatureEnabled(config.company_id, "TEAMS_SLACK_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Channel actions are not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
        },
        { status: 403 },
      );
    }
    throw error;
  }

  const signatureHeader =
    request.headers.get("x-inductlite-signature") ??
    request.headers.get("x-channel-signature") ??
    "";
  const timestampHeader =
    request.headers.get("x-inductlite-timestamp") ??
    request.headers.get("x-channel-timestamp") ??
    "";
  const secret =
    config.signing_secret ??
    process.env.CHANNEL_INTEGRATION_SIGNING_SECRET ??
    "";
  const timestampToleranceSeconds = Number(
    process.env.CHANNEL_INTEGRATION_TIMESTAMP_TOLERANCE_SECONDS ??
      DEFAULT_CHANNEL_TIMESTAMP_TOLERANCE_SECONDS,
  );

  if (!signatureHeader || !timestampHeader || !secret || secret.length < 16) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing signing credentials (CONTROL_ID: INT-001)",
      },
      { status: 403 },
    );
  }

  if (
    !Number.isFinite(timestampToleranceSeconds) ||
    timestampToleranceSeconds <= 0 ||
    !isTimestampWithinTolerance(timestampHeader, timestampToleranceSeconds)
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid or expired callback timestamp (CONTROL_ID: INT-002)",
      },
      { status: 403 },
    );
  }

  if (
    !verifyHmacSignature({
      payload: rawBody,
      secret,
      signatureHeader,
      timestamp: timestampHeader,
    })
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid signature (CONTROL_ID: INT-001)",
      },
      { status: 403 },
    );
  }

  const clientKey = getStableClientKey(
    {
      "x-forwarded-for": request.headers.get("x-forwarded-for") ?? undefined,
      "x-real-ip": request.headers.get("x-real-ip") ?? undefined,
      "user-agent": request.headers.get("user-agent") ?? undefined,
      accept: request.headers.get("accept") ?? undefined,
    },
    { trustProxy: process.env.TRUST_PROXY === "1" },
  );
  const rateLimit = await checkChannelActionRateLimit(config.company_id, {
    clientKey,
  });
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Channel action rate limit exceeded (CONTROL_ID: ABUSE-006|ABUSE-007)",
        controlId: "ABUSE-006|ABUSE-007",
        violatedLimit: `RL_ADMIN_PER_IP_PER_MIN=${process.env.RL_ADMIN_PER_IP_PER_MIN ?? "120"}|RL_ADMIN_MUTATION_PER_COMPANY_PER_MIN=${process.env.RL_ADMIN_MUTATION_PER_COMPANY_PER_MIN ?? "60"}`,
        scope: "company",
      },
      { status: 429 },
    );
  }

  const idempotencyKey = `channel-action:${parsed.data.actionId}`;
  let deliveryId: string | null = null;
  try {
    const delivery = await createChannelDelivery(config.company_id, {
      integration_config_id: config.id,
      event_type: "channel.approval_action",
      payload: parsed.data,
      idempotency_key: idempotencyKey,
    });
    deliveryId = delivery.id;
  } catch {
    // Duplicate idempotency key means this action already ran.
    return NextResponse.json({
      success: true,
      duplicate: true,
      message: "Action already processed",
    });
  }

  try {
    const updated = await transitionVisitorApprovalRequest(config.company_id, {
      approval_request_id: parsed.data.approvalRequestId,
      status: parsed.data.decision,
      reviewed_by: `channel:${config.provider.toLowerCase()}`,
      decision_notes: parsed.data.notes,
    });

    if (!deliveryId) {
      throw new Error("Missing channel delivery identifier");
    }

    await markChannelDeliveryStatus(config.company_id, {
      delivery_id: deliveryId,
      status: "ACKNOWLEDGED",
      response_status_code: 200,
      response_body: "Action applied",
    });

    await createCommunicationEvent(config.company_id, {
      site_id: config.site_id ?? undefined,
      direction: "INBOUND",
      channel: config.provider,
      event_type: "channel.approval_action.applied",
      payload: {
        action_id: parsed.data.actionId,
        approval_request_id: updated.id,
        decision: updated.status,
      },
      status: "applied",
    });

    await createAuditLog(config.company_id, {
      action: "channel.approval_action",
      entity_type: "VisitorApprovalRequest",
      entity_id: updated.id,
      user_id: undefined,
      details: {
        provider: config.provider,
        action_id: parsed.data.actionId,
        decision: parsed.data.decision,
        notes: parsed.data.notes ?? null,
      },
      ip_address: getClientIpFromHeaders(request.headers),
      user_agent: getUserAgentFromHeaders(request.headers),
    });

    return NextResponse.json({
      success: true,
      duplicate: false,
      approvalRequestId: updated.id,
      status: updated.status,
    });
  } catch (error) {
    if (deliveryId) {
      await markChannelDeliveryStatus(config.company_id, {
        delivery_id: deliveryId,
        status: "FAILED",
        response_status_code: 500,
        response_body:
          error instanceof Error ? error.message : "Approval action failed",
        increment_retry: true,
      });
    }

    return NextResponse.json(
      { success: false, error: "Failed to apply channel action" },
      { status: 500 },
    );
  }
}
