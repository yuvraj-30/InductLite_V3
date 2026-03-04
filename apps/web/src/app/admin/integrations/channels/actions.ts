"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertOrigin, checkPermission } from "@/lib/auth";
import { generateRequestId } from "@/lib/auth/csrf";
import { createRequestLogger } from "@/lib/logger";
import { checkAdminMutationRateLimit } from "@/lib/rate-limit";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  findChannelIntegrationConfigById,
  upsertChannelIntegrationConfig,
} from "@/lib/repository/communication.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { sendChannelTestMessageAction } from "@/app/admin/communications/actions";

export type ChannelIntegrationActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

const upsertChannelSchema = z.object({
  integrationId: z.string().cuid().optional().or(z.literal("")),
  siteId: z.string().cuid().optional().or(z.literal("")),
  provider: z.enum(["TEAMS", "SLACK"]),
  endpointUrl: z.string().url(),
  authToken: z.string().max(600).optional().or(z.literal("")),
  signingSecret: z.string().max(600).optional().or(z.literal("")),
  mappingsJson: z.string().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

const deactivateChannelSchema = z.object({
  integrationId: z.string().cuid(),
});

function parseOptionalJson(
  value: string,
  fallback: Record<string, unknown> = {},
): Record<string, unknown> {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

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

async function ensureChannelFeature(
  companyId: string,
): Promise<ChannelIntegrationActionResult | null> {
  try {
    await assertCompanyFeatureEnabled(companyId, "TEAMS_SLACK_V1");
    return null;
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return {
        success: false,
        error:
          "Teams/Slack integrations are not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
      };
    }
    throw error;
  }
}

export async function upsertChannelIntegrationAction(
  _prevState: ChannelIntegrationActionResult | null,
  formData: FormData,
): Promise<ChannelIntegrationActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorizeMutation();
  if (!auth.success) return auth;

  const parsed = upsertChannelSchema.safeParse({
    integrationId: formData.get("integrationId")?.toString() ?? "",
    siteId: formData.get("siteId")?.toString() ?? "",
    provider: formData.get("provider")?.toString() ?? "SLACK",
    endpointUrl: formData.get("endpointUrl")?.toString() ?? "",
    authToken: formData.get("authToken")?.toString() ?? "",
    signingSecret: formData.get("signingSecret")?.toString() ?? "",
    mappingsJson: formData.get("mappingsJson")?.toString() ?? "",
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const featureError = await ensureChannelFeature(auth.companyId);
  if (featureError) return featureError;

  const log = createRequestLogger(auth.requestId, {
    path: "/admin/integrations/channels",
    method: "POST",
  });

  try {
    const config = await upsertChannelIntegrationConfig(auth.companyId, {
      id: parsed.data.integrationId || undefined,
      site_id: parsed.data.siteId || undefined,
      provider: parsed.data.provider,
      endpoint_url: parsed.data.endpointUrl,
      auth_token: parsed.data.authToken || undefined,
      signing_secret: parsed.data.signingSecret || undefined,
      mappings: parseOptionalJson(parsed.data.mappingsJson ?? ""),
      is_active: parsed.data.isActive !== false,
    });

    await createAuditLog(auth.companyId, {
      action: "channel.integration.upsert",
      entity_type: "ChannelIntegrationConfig",
      entity_id: config.id,
      user_id: auth.userId,
      details: {
        provider: config.provider,
        site_id: config.site_id,
        endpoint_url: config.endpoint_url,
        is_active: config.is_active,
      },
      request_id: auth.requestId,
    });

    revalidatePath("/admin/integrations/channels");
    revalidatePath("/admin/communications");
    return { success: true, message: "Channel integration saved" };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to save channel integration");
    return { success: false, error: "Failed to save channel integration" };
  }
}

export async function deactivateChannelIntegrationAction(
  integrationId: string,
): Promise<ChannelIntegrationActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorizeMutation();
  if (!auth.success) return auth;

  const parsed = deactivateChannelSchema.safeParse({ integrationId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const featureError = await ensureChannelFeature(auth.companyId);
  if (featureError) return featureError;

  const existing = await findChannelIntegrationConfigById(
    auth.companyId,
    parsed.data.integrationId,
  );
  if (!existing) {
    return { success: false, error: "Integration config not found" };
  }

  await upsertChannelIntegrationConfig(auth.companyId, {
    id: existing.id,
    site_id: existing.site_id ?? undefined,
    provider: existing.provider,
    endpoint_url: existing.endpoint_url,
    auth_token: existing.auth_token ?? undefined,
    signing_secret: existing.signing_secret ?? undefined,
    mappings:
      existing.mappings && typeof existing.mappings === "object"
        ? (existing.mappings as Record<string, unknown>)
        : {},
    is_active: false,
  });

  await createAuditLog(auth.companyId, {
    action: "channel.integration.deactivate",
    entity_type: "ChannelIntegrationConfig",
    entity_id: existing.id,
    user_id: auth.userId,
    details: {
      provider: existing.provider,
      site_id: existing.site_id,
    },
    request_id: auth.requestId,
  });

  revalidatePath("/admin/integrations/channels");
  revalidatePath("/admin/communications");
  return { success: true, message: "Channel integration deactivated" };
}

export async function sendChannelIntegrationTestAction(
  integrationConfigId: string,
): Promise<ChannelIntegrationActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorizeMutation();
  if (!auth.success) return auth;

  const featureError = await ensureChannelFeature(auth.companyId);
  if (featureError) return featureError;

  const formData = new FormData();
  formData.set("integrationConfigId", integrationConfigId);
  formData.set(
    "message",
    `InductLite connectivity test at ${new Date().toISOString()}`,
  );

  const result = await sendChannelTestMessageAction(null, formData);
  if (!result.success) {
    return result;
  }
  return { success: true, message: "Test message queued" };
}
