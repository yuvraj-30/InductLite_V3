"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertOrigin, checkSitePermission } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  createIncidentReport,
  findIncidentReportById,
  resolveIncidentReport,
} from "@/lib/repository/incident.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import type { IncidentSeverity, IncidentType } from "@prisma/client";

const createIncidentSchema = z.object({
  siteId: z.string().cuid("Invalid site ID"),
  signInRecordId: z.string().cuid("Invalid sign-in record ID").optional().or(z.literal("")),
  incidentType: z.enum(["INCIDENT", "NEAR_MISS"]).default("INCIDENT"),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  title: z.string().min(3, "Title is required").max(160),
  description: z.string().max(4000).optional().or(z.literal("")),
  immediateActions: z.string().max(2000).optional().or(z.literal("")),
  occurredAt: z.string().optional().or(z.literal("")),
  isNotifiable: z.coerce.boolean().default(false),
  worksafeReferenceNumber: z.string().max(120).optional().or(z.literal("")),
  worksafeNotifiedAt: z.string().optional().or(z.literal("")),
  legalHold: z.coerce.boolean().default(false),
});

export type IncidentActionResult =
  | { success: true; message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createIncidentReportAction(
  _prevState: IncidentActionResult | null,
  formData: FormData,
): Promise<IncidentActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/incidents",
    method: "POST",
  });

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const parsed = createIncidentSchema.safeParse({
    siteId: formData.get("siteId"),
    signInRecordId: formData.get("signInRecordId"),
    incidentType: formData.get("incidentType"),
    severity: formData.get("severity"),
    title: formData.get("title"),
    description: formData.get("description"),
    immediateActions: formData.get("immediateActions"),
    occurredAt: formData.get("occurredAt"),
    isNotifiable: formData.get("isNotifiable") ?? false,
    worksafeReferenceNumber: formData.get("worksafeReferenceNumber"),
    worksafeNotifiedAt: formData.get("worksafeNotifiedAt"),
    legalHold: formData.get("legalHold") ?? false,
  });

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

  let occurredAt: Date | undefined;
  if (parsed.data.occurredAt) {
    occurredAt = new Date(parsed.data.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      return { success: false, error: "Invalid occurred-at timestamp" };
    }
  }

  let worksafeNotifiedAt: Date | undefined;
  if (parsed.data.worksafeNotifiedAt) {
    worksafeNotifiedAt = new Date(parsed.data.worksafeNotifiedAt);
    if (Number.isNaN(worksafeNotifiedAt.getTime())) {
      return { success: false, error: "Invalid WorkSafe notified timestamp" };
    }
  }
  if (!parsed.data.isNotifiable && worksafeNotifiedAt) {
    return {
      success: false,
      error: "WorkSafe notified timestamp requires a notifiable incident",
    };
  }
  if (
    !parsed.data.isNotifiable &&
    parsed.data.worksafeReferenceNumber &&
    parsed.data.worksafeReferenceNumber.trim().length > 0
  ) {
    return {
      success: false,
      error: "WorkSafe reference number requires a notifiable incident",
    };
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    const created = await createIncidentReport(context.companyId, {
      site_id: parsed.data.siteId,
      sign_in_record_id: parsed.data.signInRecordId || undefined,
      incident_type: parsed.data.incidentType as IncidentType,
      severity: parsed.data.severity as IncidentSeverity,
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      immediate_actions: parsed.data.immediateActions || undefined,
      occurred_at: occurredAt,
      is_notifiable: parsed.data.isNotifiable,
      worksafe_notified_at: worksafeNotifiedAt,
      worksafe_reference_number: parsed.data.worksafeReferenceNumber || undefined,
      worksafe_notified_by: worksafeNotifiedAt ? context.userId : undefined,
      legal_hold: parsed.data.legalHold,
      reported_by: context.userId,
    });

    await createAuditLog(context.companyId, {
      action: "incident.create",
      entity_type: "IncidentReport",
      entity_id: created.id,
      user_id: context.userId,
      details: {
        site_id: created.site_id,
        sign_in_record_id: created.sign_in_record_id,
        incident_type: created.incident_type,
        severity: created.severity,
        is_notifiable: created.is_notifiable,
        worksafe_notified_at: created.worksafe_notified_at,
        worksafe_reference_number: created.worksafe_reference_number,
        legal_hold: created.legal_hold,
      },
      request_id: requestId,
    });

    revalidatePath("/admin/incidents");
    revalidatePath("/admin/live-register");
    revalidatePath(`/admin/sites/${parsed.data.siteId}`);

    return { success: true, message: "Incident report logged" };
  } catch (error) {
    log.error({ error: String(error) }, "Create incident report failed");
    return { success: false, error: "Failed to log incident report" };
  }
}

export async function resolveIncidentReportAction(
  incidentId: string,
): Promise<IncidentActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/incidents",
    method: "POST",
  });

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const parsedId = z.string().cuid().safeParse(incidentId);
  if (!parsedId.success) {
    return { success: false, error: "Invalid incident ID" };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const existing = await findIncidentReportById(context.companyId, parsedId.data);
  if (!existing) {
    return { success: false, error: "Incident report not found" };
  }

  const guard = await checkSitePermission("site:manage", existing.site_id);
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  try {
    const resolved = await resolveIncidentReport(
      context.companyId,
      parsedId.data,
      context.userId,
    );

    await createAuditLog(context.companyId, {
      action: "incident.resolve",
      entity_type: "IncidentReport",
      entity_id: resolved.id,
      user_id: context.userId,
      details: { site_id: resolved.site_id, status: resolved.status },
      request_id: requestId,
    });

    revalidatePath("/admin/incidents");
    revalidatePath("/admin/live-register");
    revalidatePath(`/admin/sites/${resolved.site_id}`);
    return { success: true, message: "Incident report closed" };
  } catch (error) {
    log.error({ error: String(error) }, "Resolve incident report failed");
    return { success: false, error: "Failed to close incident report" };
  }
}
