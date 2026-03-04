import { NextRequest, NextResponse } from "next/server";
import { assertOrigin } from "@/lib/auth/csrf";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  deactivateDeviceSubscription,
  upsertDeviceSubscription,
} from "@/lib/repository/mobile-ops.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";

interface PushSubscriptionPayload {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  siteId?: string;
  platform?: string;
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request: NextRequest) {
  try {
    await assertOrigin();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request origin" }, { status: 403 });
  }

  let context;
  try {
    context = await requireAuthenticatedContextReadOnly();
  } catch {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  if (!isFeatureEnabled("PWA_PUSH_V1")) {
    return NextResponse.json(
      {
        success: false,
        error: "Push subscriptions are disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001)",
      },
      { status: 403 },
    );
  }
  try {
    await assertCompanyFeatureEnabled(context.companyId, "PWA_PUSH_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Push subscriptions are not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
        },
        { status: 403 },
      );
    }
    throw error;
  }

  let payload: PushSubscriptionPayload;
  try {
    payload = (await request.json()) as PushSubscriptionPayload;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  if (
    !isNonEmpty(payload.endpoint) ||
    !isNonEmpty(payload.keys?.p256dh) ||
    !isNonEmpty(payload.keys?.auth)
  ) {
    return NextResponse.json(
      { success: false, error: "Missing push subscription fields" },
      { status: 400 },
    );
  }

  const subscription = await upsertDeviceSubscription(context.companyId, {
    endpoint: payload.endpoint,
    public_key: payload.keys.p256dh,
    auth_key: payload.keys.auth,
    site_id: isNonEmpty(payload.siteId) ? payload.siteId : undefined,
    user_id: context.userId,
    platform: isNonEmpty(payload.platform) ? payload.platform : undefined,
  });

  await createAuditLog(context.companyId, {
    action: "push.subscription.upsert",
    entity_type: "DeviceSubscription",
    entity_id: subscription.id,
    user_id: context.userId,
    details: {
      site_id: subscription.site_id,
      platform: subscription.platform,
      endpoint: subscription.endpoint,
    },
  });

  return NextResponse.json({
    success: true,
    subscriptionId: subscription.id,
  });
}

export async function DELETE(request: NextRequest) {
  try {
    await assertOrigin();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request origin" }, { status: 403 });
  }

  let context;
  try {
    context = await requireAuthenticatedContextReadOnly();
  } catch {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  if (!isFeatureEnabled("PWA_PUSH_V1")) {
    return NextResponse.json(
      {
        success: false,
        error: "Push subscriptions are disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001)",
      },
      { status: 403 },
    );
  }
  try {
    await assertCompanyFeatureEnabled(context.companyId, "PWA_PUSH_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Push subscriptions are not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
        },
        { status: 403 },
      );
    }
    throw error;
  }

  let payload: { endpoint?: string };
  try {
    payload = (await request.json()) as { endpoint?: string };
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!isNonEmpty(payload.endpoint)) {
    return NextResponse.json({ success: false, error: "endpoint is required" }, { status: 400 });
  }

  await deactivateDeviceSubscription(context.companyId, payload.endpoint);
  await createAuditLog(context.companyId, {
    action: "push.subscription.deactivate",
    entity_type: "DeviceSubscription",
    user_id: context.userId,
    details: {
      endpoint: payload.endpoint,
    },
  });

  return NextResponse.json({ success: true });
}
