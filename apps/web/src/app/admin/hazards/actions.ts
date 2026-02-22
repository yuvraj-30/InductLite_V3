"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertOrigin, checkSitePermission } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  createHazard,
  closeHazard,
  findHazardById,
} from "@/lib/repository/hazard.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import type { HazardRiskLevel } from "@prisma/client";

const createHazardSchema = z.object({
  siteId: z.string().cuid("Invalid site ID"),
  title: z.string().min(3, "Hazard title is required").max(160),
  description: z.string().max(4000).optional().or(z.literal("")),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
});

export type HazardActionResult =
  | { success: true; message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createHazardAction(
  _prevState: HazardActionResult | null,
  formData: FormData,
): Promise<HazardActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/hazards",
    method: "POST",
  });

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const raw = {
    siteId: formData.get("siteId"),
    title: formData.get("title"),
    description: formData.get("description"),
    riskLevel: formData.get("riskLevel"),
  };
  const parsed = createHazardSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const err of parsed.error.errors) {
      const field = String(err.path[0] ?? "form");
      fieldErrors[field] = fieldErrors[field] ?? [];
      fieldErrors[field].push(err.message);
    }
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input",
      fieldErrors,
    };
  }

  const guard = await checkSitePermission("site:manage", parsed.data.siteId);
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    const hazard = await createHazard(context.companyId, {
      site_id: parsed.data.siteId,
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      risk_level: parsed.data.riskLevel as HazardRiskLevel,
      identified_by: context.userId,
    });

    await createAuditLog(context.companyId, {
      action: "hazard.create",
      entity_type: "HazardRegisterEntry",
      entity_id: hazard.id,
      user_id: context.userId,
      details: {
        site_id: hazard.site_id,
        risk_level: hazard.risk_level,
      },
      request_id: requestId,
    });

    revalidatePath("/admin/hazards");
    revalidatePath(`/admin/sites/${parsed.data.siteId}/emergency`);

    return { success: true, message: "Hazard added to register" };
  } catch (error) {
    log.error({ error: String(error) }, "Create hazard failed");
    return { success: false, error: "Failed to create hazard" };
  }
}

export async function closeHazardAction(
  hazardId: string,
): Promise<HazardActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/hazards",
    method: "POST",
  });

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const parsedId = z.string().cuid().safeParse(hazardId);
  if (!parsedId.success) {
    return { success: false, error: "Invalid hazard ID" };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const existing = await findHazardById(context.companyId, parsedId.data);
  if (!existing) {
    return { success: false, error: "Hazard not found" };
  }

  const guard = await checkSitePermission("site:manage", existing.site_id);
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  try {
    const hazard = await closeHazard(context.companyId, parsedId.data, context.userId);
    await createAuditLog(context.companyId, {
      action: "hazard.close",
      entity_type: "HazardRegisterEntry",
      entity_id: hazard.id,
      user_id: context.userId,
      details: { site_id: hazard.site_id },
      request_id: requestId,
    });

    revalidatePath("/admin/hazards");
    revalidatePath(`/admin/sites/${hazard.site_id}/emergency`);
    return { success: true, message: "Hazard closed" };
  } catch (error) {
    log.error({ error: String(error) }, "Close hazard failed");
    return { success: false, error: "Failed to close hazard" };
  }
}
