"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertOrigin, checkPermission } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { generateRequestId } from "@/lib/auth/csrf";
import { createRequestLogger } from "@/lib/logger";
import { checkAdminMutationRateLimit } from "@/lib/rate-limit";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { listCurrentlyOnSite } from "@/lib/repository/signin.repository";
import {
  createPresenceHint,
  listPresenceHints,
  resolvePresenceHint,
  upsertDeviceSubscription,
} from "@/lib/repository/mobile-ops.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";

export type MobileActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

const runAssistSchema = z.object({
  siteId: z.string().cuid().optional().or(z.literal("")),
  staleMinutes: z.coerce.number().int().min(30).max(2880).default(720),
});

const resolveHintSchema = z.object({
  hintId: z.string().cuid(),
  status: z.enum(["ACCEPTED", "DISMISSED", "AUTO_RESOLVED"]),
  resolutionNotes: z.string().max(1000).optional().or(z.literal("")),
});

const registerDeviceSchema = z.object({
  endpoint: z.string().url(),
  publicKey: z.string().min(10),
  authKey: z.string().min(10),
  siteId: z.string().cuid().optional().or(z.literal("")),
  platform: z.string().max(40).optional().or(z.literal("")),
});

async function authorizeMutation(): Promise<
  | { success: true; companyId: string; userId: string; requestId: string }
  | { success: false; error: string }
> {
  const permission = await checkPermission("site:manage");
  if (!permission.success) {
    return { success: false, error: permission.error };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const rate = await checkAdminMutationRateLimit(context.companyId, context.userId);
  if (!rate.success) {
    return {
      success: false,
      error: "Too many admin updates right now. Please retry in a minute.",
    };
  }

  return {
    success: true,
    companyId: context.companyId,
    userId: context.userId,
    requestId: generateRequestId(),
  };
}

async function ensureMobileFeatures(companyId: string): Promise<MobileActionResult | null> {
  if (!isFeatureEnabled("PWA_PUSH_V1")) {
    return {
      success: false,
      error:
        "Mobile push/assist workflows are disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001)",
    };
  }

  try {
    await assertCompanyFeatureEnabled(companyId, "PWA_PUSH_V1");
    return null;
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return {
        success: false,
        error:
          "Mobile push/assist workflows are not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
      };
    }
    throw error;
  }
}

export async function runAutoCheckoutAssistAction(
  _prevState: MobileActionResult | null,
  formData: FormData,
): Promise<MobileActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorizeMutation();
  if (!auth.success) return auth;

  const parsed = runAssistSchema.safeParse({
    siteId: formData.get("siteId")?.toString() ?? "",
    staleMinutes: formData.get("staleMinutes")?.toString() ?? "720",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const featureError = await ensureMobileFeatures(auth.companyId);
  if (featureError) return featureError;

  const log = createRequestLogger(auth.requestId, {
    path: "/admin/mobile",
    method: "POST",
  });

  try {
    const now = Date.now();
    const staleThresholdMs = parsed.data.staleMinutes * 60 * 1000;
    const active = await listCurrentlyOnSite(
      auth.companyId,
      parsed.data.siteId || undefined,
      100,
    );
    let hintsCreated = 0;

    for (const record of active) {
      const durationMs = now - record.sign_in_ts.getTime();
      if (durationMs < staleThresholdMs) {
        continue;
      }

      const existing = await listPresenceHints(auth.companyId, {
        sign_in_record_id: record.id,
        status: "OPEN",
        limit: 1,
      });
      if (existing.length > 0) {
        continue;
      }

      await createPresenceHint(auth.companyId, {
        site_id: record.site_id,
        sign_in_record_id: record.id,
        hint_type: "AUTO_CHECKOUT_RECOMMENDATION",
        hint_payload: {
          visitor_name: record.visitor_name,
          visitor_phone: record.visitor_phone,
          duration_minutes: Math.floor(durationMs / 60000),
        },
      });
      hintsCreated += 1;
    }

    await createAuditLog(auth.companyId, {
      action: "mobile.auto_checkout_assist.run",
      entity_type: "PresenceHint",
      user_id: auth.userId,
      details: {
        site_id: parsed.data.siteId || null,
        stale_minutes: parsed.data.staleMinutes,
        active_records: active.length,
        hints_created: hintsCreated,
      },
      request_id: auth.requestId,
    });

    revalidatePath("/admin/mobile");
    return {
      success: true,
      message: `Auto checkout assist completed (${hintsCreated} hints created)`,
    };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to run auto checkout assist");
    return { success: false, error: "Failed to run auto checkout assist" };
  }
}

export async function resolvePresenceHintAction(
  hintId: string,
  status: "ACCEPTED" | "DISMISSED" | "AUTO_RESOLVED",
  resolutionNotes?: string,
): Promise<MobileActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorizeMutation();
  if (!auth.success) return auth;

  const parsed = resolveHintSchema.safeParse({
    hintId,
    status,
    resolutionNotes: resolutionNotes ?? "",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const featureError = await ensureMobileFeatures(auth.companyId);
  if (featureError) return featureError;

  const resolved = await resolvePresenceHint(
    auth.companyId,
    parsed.data.hintId,
    parsed.data.status,
    parsed.data.resolutionNotes || undefined,
  );
  await createAuditLog(auth.companyId, {
    action: "mobile.presence_hint.resolve",
    entity_type: "PresenceHint",
    entity_id: resolved.id,
    user_id: auth.userId,
    details: {
      status: resolved.status,
      resolution_notes: resolved.resolution_notes,
    },
    request_id: auth.requestId,
  });

  revalidatePath("/admin/mobile");
  return { success: true, message: "Presence hint resolved" };
}

export async function registerDeviceSubscriptionAction(
  _prevState: MobileActionResult | null,
  formData: FormData,
): Promise<MobileActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorizeMutation();
  if (!auth.success) return auth;

  const parsed = registerDeviceSchema.safeParse({
    endpoint: formData.get("endpoint")?.toString() ?? "",
    publicKey: formData.get("publicKey")?.toString() ?? "",
    authKey: formData.get("authKey")?.toString() ?? "",
    siteId: formData.get("siteId")?.toString() ?? "",
    platform: formData.get("platform")?.toString() ?? "",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const featureError = await ensureMobileFeatures(auth.companyId);
  if (featureError) return featureError;

  const device = await upsertDeviceSubscription(auth.companyId, {
    endpoint: parsed.data.endpoint,
    public_key: parsed.data.publicKey,
    auth_key: parsed.data.authKey,
    site_id: parsed.data.siteId || undefined,
    user_id: auth.userId,
    platform: parsed.data.platform || undefined,
  });
  await createAuditLog(auth.companyId, {
    action: "mobile.device_subscription.upsert",
    entity_type: "DeviceSubscription",
    entity_id: device.id,
    user_id: auth.userId,
    details: {
      site_id: device.site_id,
      platform: device.platform,
      endpoint: device.endpoint,
    },
    request_id: auth.requestId,
  });

  revalidatePath("/admin/mobile");
  return { success: true, message: "Device subscription saved" };
}
