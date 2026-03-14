import { NextRequest, NextResponse } from "next/server";
import { heartbeatPayloadSchema } from "@inductlite/shared";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  EntitlementDeniedError,
  assertCompanyFeatureEnabled,
} from "@/lib/plans";
import { createAuditLog } from "@/lib/repository/audit.repository";
import {
  createMobileDeviceRuntimeEvent,
  findActiveDeviceSubscriptionByEndpoint,
  touchDeviceSubscriptionHeartbeat,
} from "@/lib/repository/mobile-ops.repository";
import {
  parseBearerToken,
  verifyMobileEnrollmentToken,
} from "@/lib/mobile/enrollment-token";
import { encodeDeviceRuntime } from "@/lib/mobile/device-runtime";

export async function POST(request: NextRequest) {
  const token = parseBearerToken(request.headers.get("authorization"));
  if (!token) {
    return NextResponse.json(
      { success: false, error: "Missing bearer token" },
      { status: 401 },
    );
  }

  const verified = verifyMobileEnrollmentToken(token);
  if (!verified.valid) {
    return NextResponse.json(
      { success: false, error: "Invalid enrollment token" },
      { status: 401 },
    );
  }

  if (!isFeatureEnabled("PWA_PUSH_V1")) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Mobile heartbeat is disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001)",
      },
      { status: 403 },
    );
  }
  if (!isFeatureEnabled("NATIVE_MOBILE_RUNTIME_V1")) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Native mobile runtime is disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001)",
      },
      { status: 403 },
    );
  }

  const enrollment = verified.payload;
  const companyId = enrollment.companyId;
  try {
    await assertCompanyFeatureEnabled(companyId, "MOBILE_OFFLINE_ASSIST_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Mobile heartbeat is not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
        },
        { status: 403 },
      );
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = heartbeatPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid heartbeat payload",
      },
      { status: 400 },
    );
  }

  const requestEndpoint = parsed.data.endpoint?.trim();
  if (requestEndpoint && requestEndpoint !== enrollment.endpoint) {
    return NextResponse.json(
      { success: false, error: "Heartbeat endpoint does not match enrollment token" },
      { status: 400 },
    );
  }

  const subscription = await findActiveDeviceSubscriptionByEndpoint(
    companyId,
    enrollment.endpoint,
  );
  if (!subscription) {
    return NextResponse.json(
      {
        success: false,
        error: "Enrolled device subscription is no longer active",
      },
      { status: 401 },
    );
  }
  if (
    enrollment.deviceId !== subscription.id ||
    enrollment.tokenVersion !== subscription.token_version
  ) {
    await createMobileDeviceRuntimeEvent(companyId, {
      site_id: enrollment.siteId,
      device_subscription_id: subscription.id,
      event_type: "HEARTBEAT",
      event_status: "REJECTED",
      runtime_tag: subscription.platform ?? null,
      reason: "token_version_mismatch",
      payload: {
        token_version: enrollment.tokenVersion,
        expected_token_version: subscription.token_version,
      },
    });
    return NextResponse.json(
      { success: false, error: "Enrollment token version is no longer valid" },
      { status: 401 },
    );
  }

  const runtimeTag = encodeDeviceRuntime({
    platform: parsed.data.platform || subscription.platform || "unknown",
    appVersion: parsed.data.appVersion || null,
    osVersion: parsed.data.osVersion || null,
    wrapperChannel: parsed.data.wrapperChannel || null,
  });

  const updated = await touchDeviceSubscriptionHeartbeat(
    companyId,
    enrollment.endpoint,
    {
      platform: runtimeTag,
      active: true,
    },
  );

  await createAuditLog(companyId, {
    action: "mobile.device.heartbeat",
    entity_type: "DeviceSubscription",
    entity_id: updated?.id ?? subscription.id,
    user_id: subscription.user_id ?? undefined,
    details: {
      site_id: enrollment.siteId,
      endpoint: enrollment.endpoint,
      runtime: runtimeTag,
    },
  });

  await createMobileDeviceRuntimeEvent(companyId, {
    site_id: enrollment.siteId,
    device_subscription_id: subscription.id,
    event_type: "HEARTBEAT",
    event_status: "ACCEPTED",
    runtime_tag: runtimeTag,
    reason: "heartbeat_received",
    payload: {
      endpoint: enrollment.endpoint,
    },
  });

  return NextResponse.json({
    success: true,
    endpoint: enrollment.endpoint,
    lastSeenAt: updated?.last_seen_at?.toISOString() ?? new Date().toISOString(),
    runtime: runtimeTag,
  });
}
