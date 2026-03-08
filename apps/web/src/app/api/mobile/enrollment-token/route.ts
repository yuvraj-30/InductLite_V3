import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertOrigin } from "@/lib/auth/csrf";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { createAuditLog } from "@/lib/repository/audit.repository";
import {
  createMobileDeviceRuntimeEvent,
  findActiveDeviceSubscriptionByEndpoint,
  rotateDeviceSubscriptionTokenVersion,
} from "@/lib/repository/mobile-ops.repository";
import { generateMobileEnrollmentToken } from "@/lib/mobile/enrollment-token";

const requestSchema = z.object({
  endpoint: z.string().url().max(2000),
  siteId: z.string().cuid(),
  visitorName: z.string().trim().min(2).max(120),
  visitorPhone: z.string().trim().min(5).max(40),
  visitorEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
  employerName: z.string().trim().max(120).optional().or(z.literal("")),
  visitorType: z
    .enum(["CONTRACTOR", "VISITOR", "EMPLOYEE", "DELIVERY"])
    .default("EMPLOYEE"),
  expiresInMinutes: z.coerce.number().int().min(15).max(60 * 24 * 90).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await assertOrigin();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request origin" },
      { status: 403 },
    );
  }

  let context;
  try {
    context = await requireAuthenticatedContextReadOnly();
  } catch {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  }

  if (context.role === "VIEWER") {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions" },
      { status: 403 },
    );
  }

  if (!isFeatureEnabled("PWA_PUSH_V1")) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Mobile enrollment is disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001)",
      },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid request payload" },
      { status: 400 },
    );
  }

  try {
    await assertCompanyFeatureEnabled(
      context.companyId,
      "MOBILE_OFFLINE_ASSIST_V1",
      parsed.data.siteId,
    );
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Mobile geofence automation is not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
        },
        { status: 403 },
      );
    }
    throw error;
  }

  const subscription = await findActiveDeviceSubscriptionByEndpoint(
    context.companyId,
    parsed.data.endpoint,
  );
  if (!subscription) {
    return NextResponse.json(
      {
        success: false,
        error: "Active device subscription not found for endpoint",
      },
      { status: 404 },
    );
  }

  if (subscription.site_id && subscription.site_id !== parsed.data.siteId) {
    return NextResponse.json(
      {
        success: false,
        error: "Device subscription is scoped to a different site",
      },
      { status: 400 },
    );
  }

  const rotated = await rotateDeviceSubscriptionTokenVersion(
    context.companyId,
    parsed.data.endpoint,
  );
  if (!rotated) {
    return NextResponse.json(
      {
        success: false,
        error: "Active device subscription not found for endpoint",
      },
      { status: 404 },
    );
  }

  const generated = generateMobileEnrollmentToken({
    deviceId: rotated.id,
    runtime: rotated.platform ?? "unknown",
    tokenVersion: rotated.token_version,
    companyId: context.companyId,
    siteId: parsed.data.siteId,
    endpoint: parsed.data.endpoint,
    visitorName: parsed.data.visitorName,
    visitorPhone: parsed.data.visitorPhone,
    visitorEmail: parsed.data.visitorEmail || null,
    employerName: parsed.data.employerName || null,
    visitorType: parsed.data.visitorType,
    expiresInMinutes: parsed.data.expiresInMinutes,
  });

  await createAuditLog(context.companyId, {
    action: "mobile.enrollment_token.issue",
    entity_type: "DeviceSubscription",
    entity_id: rotated.id,
    user_id: context.userId,
    details: {
      site_id: parsed.data.siteId,
      endpoint: parsed.data.endpoint,
      visitor_type: parsed.data.visitorType,
      token_version: rotated.token_version,
      expires_at: generated.expiresAt.toISOString(),
    },
  });

  await createMobileDeviceRuntimeEvent(context.companyId, {
    site_id: parsed.data.siteId,
    device_subscription_id: rotated.id,
    event_type: "ENROLLMENT",
    event_status: "ACCEPTED",
    runtime_tag: rotated.platform ?? "unknown",
    reason: "mobile_enrollment_token_issued",
    payload: {
      endpoint: parsed.data.endpoint,
      token_version: rotated.token_version,
    },
  });

  return NextResponse.json({
    success: true,
    token: generated.token,
    expiresAt: generated.expiresAt.toISOString(),
  });
}
