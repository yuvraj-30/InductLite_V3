"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertOrigin, checkSitePermission } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  createSiteEmergencyContact,
  deactivateSiteEmergencyContact,
  createSiteEmergencyProcedure,
  deactivateSiteEmergencyProcedure,
} from "@/lib/repository/emergency.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { generateRequestId } from "@/lib/auth/csrf";
import { createRequestLogger } from "@/lib/logger";

const emergencyContactSchema = z.object({
  name: z.string().min(2, "Name is required").max(120),
  role: z.string().max(120).optional().or(z.literal("")),
  phone: z.string().min(6, "Phone is required").max(40),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
  priority: z.coerce.number().int().min(0).max(100).default(0),
});

const emergencyProcedureSchema = z.object({
  title: z.string().min(2, "Title is required").max(120),
  instructions: z.string().min(4, "Instructions are required").max(10_000),
  sortOrder: z.coerce.number().int().min(0).max(200).default(0),
});

export type EmergencyActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

function siteEmergencyPath(siteId: string): string {
  return `/admin/sites/${siteId}/emergency`;
}

export async function createEmergencyContactAction(
  siteId: string,
  _prevState: EmergencyActionResult | null,
  formData: FormData,
): Promise<EmergencyActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: siteEmergencyPath(siteId),
    method: "POST",
  });

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const parsed = emergencyContactSchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
    role: formData.get("role")?.toString() ?? "",
    phone: formData.get("phone")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
    priority: formData.get("priority")?.toString() ?? "0",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const guard = await checkSitePermission("site:manage", siteId);
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const context = await requireAuthenticatedContextReadOnly();
  try {
    const created = await createSiteEmergencyContact(context.companyId, {
      site_id: siteId,
      name: parsed.data.name,
      role: parsed.data.role || undefined,
      phone: parsed.data.phone,
      email: parsed.data.email || undefined,
      notes: parsed.data.notes || undefined,
      priority: parsed.data.priority,
    });

    await createAuditLog(context.companyId, {
      action: "emergency.contact.create",
      entity_type: "SiteEmergencyContact",
      entity_id: created.id,
      user_id: context.userId,
      details: { site_id: siteId, priority: created.priority },
      request_id: requestId,
    });

    revalidatePath(siteEmergencyPath(siteId));
    return { success: true, message: "Emergency contact added" };
  } catch (error) {
    log.error({ error: String(error) }, "Create emergency contact failed");
    return { success: false, error: "Failed to save emergency contact" };
  }
}

export async function deactivateEmergencyContactAction(
  siteId: string,
  contactId: string,
): Promise<EmergencyActionResult> {
  const requestId = generateRequestId();

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const guard = await checkSitePermission("site:manage", siteId);
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const context = await requireAuthenticatedContextReadOnly();
  await deactivateSiteEmergencyContact(context.companyId, contactId);
  await createAuditLog(context.companyId, {
    action: "emergency.contact.deactivate",
    entity_type: "SiteEmergencyContact",
    entity_id: contactId,
    user_id: context.userId,
    details: { site_id: siteId },
    request_id: requestId,
  });

  revalidatePath(siteEmergencyPath(siteId));
  return { success: true, message: "Emergency contact removed" };
}

export async function createEmergencyProcedureAction(
  siteId: string,
  _prevState: EmergencyActionResult | null,
  formData: FormData,
): Promise<EmergencyActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: siteEmergencyPath(siteId),
    method: "POST",
  });

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const parsed = emergencyProcedureSchema.safeParse({
    title: formData.get("title")?.toString() ?? "",
    instructions: formData.get("instructions")?.toString() ?? "",
    sortOrder: formData.get("sortOrder")?.toString() ?? "0",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const guard = await checkSitePermission("site:manage", siteId);
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const context = await requireAuthenticatedContextReadOnly();
  try {
    const created = await createSiteEmergencyProcedure(context.companyId, {
      site_id: siteId,
      title: parsed.data.title,
      instructions: parsed.data.instructions,
      sort_order: parsed.data.sortOrder,
    });

    await createAuditLog(context.companyId, {
      action: "emergency.procedure.create",
      entity_type: "SiteEmergencyProcedure",
      entity_id: created.id,
      user_id: context.userId,
      details: { site_id: siteId, sort_order: created.sort_order },
      request_id: requestId,
    });

    revalidatePath(siteEmergencyPath(siteId));
    return { success: true, message: "Emergency procedure added" };
  } catch (error) {
    log.error({ error: String(error) }, "Create emergency procedure failed");
    return { success: false, error: "Failed to save emergency procedure" };
  }
}

export async function deactivateEmergencyProcedureAction(
  siteId: string,
  procedureId: string,
): Promise<EmergencyActionResult> {
  const requestId = generateRequestId();

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const guard = await checkSitePermission("site:manage", siteId);
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const context = await requireAuthenticatedContextReadOnly();
  await deactivateSiteEmergencyProcedure(context.companyId, procedureId);
  await createAuditLog(context.companyId, {
    action: "emergency.procedure.deactivate",
    entity_type: "SiteEmergencyProcedure",
    entity_id: procedureId,
    user_id: context.userId,
    details: { site_id: siteId },
    request_id: requestId,
  });

  revalidatePath(siteEmergencyPath(siteId));
  return { success: true, message: "Emergency procedure removed" };
}
