"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { assertOrigin, checkPermission } from "@/lib/auth";
import { checkAdminMutationRateLimit } from "@/lib/rate-limit";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { findSiteById, updateSite } from "@/lib/repository/site.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { buildProcoreConnectorConfig, parseProcoreConnectorConfig } from "@/lib/integrations/procore/config";
import { queueProcoreSiteSync } from "@/lib/integrations/procore/sync";

export type ProcoreActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

const updateConfigSchema = z.object({
  siteId: z.string().cuid(),
  enabled: z.boolean().optional(),
  endpointUrl: z.string().url().optional().or(z.literal("")),
  authToken: z.string().max(512).optional().or(z.literal("")),
  inboundSharedSecret: z.string().max(512).optional().or(z.literal("")),
  projectId: z.string().max(120).optional().or(z.literal("")),
  includeSignInEvents: z.boolean().optional(),
  includePermitEvents: z.boolean().optional(),
});

const queueSyncSchema = z.object({
  siteId: z.string().cuid(),
});

async function authorizeMutation(): Promise<
  | { success: true; companyId: string; userId: string }
  | { success: false; error: string }
> {
  const permission = await checkPermission("site:manage");
  if (!permission.success) {
    return { success: false, error: permission.error };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const rateLimit = await checkAdminMutationRateLimit(context.companyId, context.userId);
  if (!rateLimit.success) {
    return {
      success: false,
      error: "Too many admin updates right now. Please retry in a minute.",
    };
  }

  if (!isFeatureEnabled("PERMITS_V1")) {
    return {
      success: false,
      error: "Connector workflows are disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001)",
    };
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "LMS_CONNECTOR");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return {
        success: false,
        error: "Connector workflows are not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
      };
    }
    throw error;
  }

  return {
    success: true,
    companyId: context.companyId,
    userId: context.userId,
  };
}

export async function updateProcoreConnectorAction(
  _prevState: ProcoreActionResult | null,
  formData: FormData,
): Promise<ProcoreActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorizeMutation();
  if (!auth.success) return auth;

  const parsed = updateConfigSchema.safeParse({
    siteId: formData.get("siteId")?.toString() ?? "",
    enabled: formData.get("enabled") === "on",
    endpointUrl: formData.get("endpointUrl")?.toString() ?? "",
    authToken: formData.get("authToken")?.toString() ?? "",
    inboundSharedSecret: formData.get("inboundSharedSecret")?.toString() ?? "",
    projectId: formData.get("projectId")?.toString() ?? "",
    includeSignInEvents: formData.get("includeSignInEvents") === "on",
    includePermitEvents: formData.get("includePermitEvents") === "on",
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid connector settings",
    };
  }

  const site = await findSiteById(auth.companyId, parsed.data.siteId);
  if (!site) {
    return { success: false, error: "Site not found" };
  }

  const existing = parseProcoreConnectorConfig(site.lms_connector);
  const config = buildProcoreConnectorConfig({
    enabled: parsed.data.enabled === true,
    endpointUrl: parsed.data.endpointUrl || null,
    authToken: parsed.data.authToken || existing.authToken,
    inboundSharedSecret:
      parsed.data.inboundSharedSecret || existing.inboundSharedSecret,
    projectId: parsed.data.projectId || null,
    includeSignInEvents: parsed.data.includeSignInEvents === true,
    includePermitEvents: parsed.data.includePermitEvents === true,
    existingConfig: existing,
  });

  await updateSite(auth.companyId, parsed.data.siteId, {
    lms_connector: config as unknown as Prisma.InputJsonValue,
  });

  await createAuditLog(auth.companyId, {
    action: "procore.connector.update",
    entity_type: "Site",
    entity_id: parsed.data.siteId,
    user_id: auth.userId,
    details: {
      enabled: config.enabled,
      endpoint_host: config.endpointUrl ? new URL(config.endpointUrl).host : null,
      has_auth_token: Boolean(config.authToken),
      has_inbound_secret: Boolean(config.inboundSharedSecret),
      include_signins: config.includeSignInEvents,
      include_permits: config.includePermitEvents,
      project_id: config.projectId,
    },
  });

  revalidatePath("/admin/integrations/procore");
  return { success: true, message: "Procore connector settings saved" };
}

export async function queueProcoreSyncAction(
  siteId: string,
): Promise<ProcoreActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorizeMutation();
  if (!auth.success) return auth;

  const parsed = queueSyncSchema.safeParse({ siteId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid site" };
  }

  const queued = await queueProcoreSiteSync({
    companyId: auth.companyId,
    siteId: parsed.data.siteId,
    requestedBy: auth.userId,
  });

  revalidatePath("/admin/integrations/procore");
  return {
    success: true,
    message: `Queued ${queued.queued} connector deliveries (${queued.includedSignIns} sign-ins, ${queued.includedPermits} permits)`,
  };
}
