import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  EntitlementDeniedError,
  assertCompanyFeatureEnabled,
} from "@/lib/plans";
import {
  createMobileDeviceRuntimeEvent,
  findActiveDeviceSubscriptionByEndpoint,
  touchDeviceSubscriptionHeartbeat,
} from "@/lib/repository/mobile-ops.repository";
import {
  parseBearerToken,
  verifyMobileEnrollmentToken,
} from "@/lib/mobile/enrollment-token";

const requestSchema = z.object({
  platform: z.string().max(40).optional().or(z.literal("")),
  appVersion: z.string().max(30).optional().or(z.literal("")),
  osVersion: z.string().max(30).optional().or(z.literal("")),
  wrapperChannel: z.string().max(40).optional().or(z.literal("")),
});

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

  if (!isFeatureEnabled("PWA_PUSH_V1") || !isFeatureEnabled("NATIVE_MOBILE_RUNTIME_V1")) {
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
    await assertCompanyFeatureEnabled(companyId, "NATIVE_MOBILE_RUNTIME_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Native mobile runtime is not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
        },
        { status: 403 },
      );
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid bootstrap payload",
      },
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
      event_type: "BOOTSTRAP",
      event_status: "REJECTED",
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

  const runtimeTag = [
    parsed.data.platform || enrollment.runtime || "unknown",
    parsed.data.appVersion || null,
    parsed.data.osVersion || null,
    parsed.data.wrapperChannel || null,
  ]
    .filter((value) => Boolean(value))
    .join("|");

  await touchDeviceSubscriptionHeartbeat(companyId, enrollment.endpoint, {
    active: true,
    platform: runtimeTag || enrollment.runtime || null || undefined,
  });

  await createMobileDeviceRuntimeEvent(companyId, {
    site_id: enrollment.siteId,
    device_subscription_id: subscription.id,
    event_type: "BOOTSTRAP",
    event_status: "ACCEPTED",
    runtime_tag: runtimeTag || enrollment.runtime || null,
    reason: "device_bootstrap_success",
    payload: {
      endpoint: enrollment.endpoint,
      token_version: enrollment.tokenVersion,
    },
  });

  return NextResponse.json({
    success: true,
    bootstrap: {
      companyId: enrollment.companyId,
      siteId: enrollment.siteId,
      endpoint: enrollment.endpoint,
      deviceId: enrollment.deviceId,
      tokenVersion: enrollment.tokenVersion,
      runtime: enrollment.runtime,
    },
    distribution: {
      iosAppStoreUrl: process.env.MOBILE_IOS_APPSTORE_URL || null,
      androidPlayUrl: process.env.MOBILE_ANDROID_PLAY_URL || null,
      iosMinVersion: process.env.MOBILE_IOS_MIN_VERSION || null,
      androidMinVersion: process.env.MOBILE_ANDROID_MIN_VERSION || null,
      wrapperRuntime: process.env.MOBILE_WRAPPER_RUNTIME || null,
      releaseChannel: process.env.MOBILE_RELEASE_CHANNEL || null,
    },
    guardrails: {
      maxGeofenceEventsPerCompanyPerDay:
        process.env.MAX_MOBILE_GEOFENCE_EVENTS_PER_COMPANY_PER_DAY || null,
      maxGeofenceEventAgeMinutes:
        process.env.MOBILE_GEOFENCE_EVENT_MAX_AGE_MINUTES || "1440",
    },
  });
}
