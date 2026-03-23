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
  createEmergencyDrill,
  startRollCallEvent,
  updateRollCallAttendance,
  markAllRollCallAttendancesAccounted,
  closeRollCallEvent,
} from "@/lib/repository/emergency.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { generateRequestId } from "@/lib/auth/csrf";
import { createRequestLogger } from "@/lib/logger";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";

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

const emergencyDrillSchema = z.object({
  drillType: z
    .enum(["EVACUATION", "FIRE", "EARTHQUAKE", "MEDICAL", "OTHER"])
    .default("EVACUATION"),
  scenario: z.string().min(4, "Scenario is required").max(3000),
  outcomeNotes: z.string().max(3000).optional().or(z.literal("")),
  followUpActions: z.string().max(3000).optional().or(z.literal("")),
  conductedAt: z.string().optional().or(z.literal("")),
  nextDueAt: z.string().optional().or(z.literal("")),
  legalHold: z.coerce.boolean().default(false),
});

const closeRollCallSchema = z.object({
  eventId: z.string().cuid("Invalid roll-call event"),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

const rollCallStatusSchema = z.enum(["ACCOUNTED", "MISSING"]);

export type EmergencyActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

function siteEmergencyPath(siteId: string): string {
  return `/admin/sites/${siteId}/emergency`;
}

async function ensureRollCallEnabled(input: {
  companyId: string;
  siteId: string;
  requestId: string;
  log: ReturnType<typeof createRequestLogger>;
}): Promise<EmergencyActionResult | null> {
  try {
    await assertCompanyFeatureEnabled(input.companyId, "ROLLCALL_V2", input.siteId);
    return null;
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return {
        success: false,
        error:
          "Emergency roll-call is not enabled for this site plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
      };
    }

    input.log.error(
      {
        requestId: input.requestId,
        companyId: input.companyId,
        siteId: input.siteId,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to evaluate roll-call entitlement",
    );
    return { success: false, error: "Failed to process emergency settings" };
  }
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
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
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
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
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

export async function createEmergencyDrillAction(
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

  const parsed = emergencyDrillSchema.safeParse({
    drillType: formData.get("drillType")?.toString() ?? "EVACUATION",
    scenario: formData.get("scenario")?.toString() ?? "",
    outcomeNotes: formData.get("outcomeNotes")?.toString() ?? "",
    followUpActions: formData.get("followUpActions")?.toString() ?? "",
    conductedAt: formData.get("conductedAt")?.toString() ?? "",
    nextDueAt: formData.get("nextDueAt")?.toString() ?? "",
    legalHold: formData.get("legalHold") ?? false,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const guard = await checkSitePermission("site:manage", siteId);
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  let conductedAt: Date | undefined;
  if (parsed.data.conductedAt) {
    conductedAt = new Date(parsed.data.conductedAt);
    if (Number.isNaN(conductedAt.getTime())) {
      return { success: false, error: "Invalid conducted-at timestamp" };
    }
  }

  let nextDueAt: Date | undefined;
  if (parsed.data.nextDueAt) {
    nextDueAt = new Date(parsed.data.nextDueAt);
    if (Number.isNaN(nextDueAt.getTime())) {
      return { success: false, error: "Invalid next-due timestamp" };
    }
  }

  const context = await requireAuthenticatedContextReadOnly();
  try {
    const created = await createEmergencyDrill(context.companyId, {
      site_id: siteId,
      drill_type: parsed.data.drillType,
      scenario: parsed.data.scenario,
      outcome_notes: parsed.data.outcomeNotes || undefined,
      follow_up_actions: parsed.data.followUpActions || undefined,
      conducted_at: conductedAt,
      next_due_at: nextDueAt,
      tested_by: context.userId,
      legal_hold: parsed.data.legalHold,
    });

    await createAuditLog(context.companyId, {
      action: "emergency.drill.create",
      entity_type: "EmergencyDrill",
      entity_id: created.id,
      user_id: context.userId,
      details: {
        site_id: siteId,
        drill_type: created.drill_type,
        legal_hold: created.legal_hold,
      },
      request_id: requestId,
    });

    revalidatePath(siteEmergencyPath(siteId));
    return { success: true, message: "Emergency drill logged" };
  } catch (error) {
    log.error({ error: String(error) }, "Create emergency drill failed");
    return { success: false, error: "Failed to save emergency drill" };
  }
}

export async function startRollCallEventAction(
  siteId: string,
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

  const guard = await checkSitePermission("site:manage", siteId);
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const entitlementError = await ensureRollCallEnabled({
    companyId: context.companyId,
    siteId,
    requestId,
    log,
  });
  if (entitlementError) {
    return entitlementError;
  }

  try {
    const created = await startRollCallEvent(context.companyId, {
      site_id: siteId,
      started_by: context.userId,
    });

    await createAuditLog(context.companyId, {
      action: "emergency.rollcall.start",
      entity_type: "EvacuationEvent",
      entity_id: created.id,
      user_id: context.userId,
      details: {
        site_id: siteId,
        total_people: created.total_people,
        accounted_count: created.accounted_count,
        missing_count: created.missing_count,
      },
      request_id: requestId,
    });

    revalidatePath(siteEmergencyPath(siteId));
    return { success: true, message: "Roll call started" };
  } catch (error) {
    log.error({ error: String(error) }, "Start roll call failed");
    return { success: false, error: "Failed to start roll call" };
  }
}

export async function updateRollCallAttendanceAction(
  siteId: string,
  eventId: string,
  attendanceId: string,
  status: "ACCOUNTED" | "MISSING",
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

  const guard = await checkSitePermission("site:manage", siteId);
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const parsedStatus = rollCallStatusSchema.safeParse(status);
  if (!parsedStatus.success) {
    return { success: false, error: "Invalid attendance status" };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const entitlementError = await ensureRollCallEnabled({
    companyId: context.companyId,
    siteId,
    requestId,
    log,
  });
  if (entitlementError) {
    return entitlementError;
  }

  try {
    const updated = await updateRollCallAttendance(context.companyId, {
      event_id: eventId,
      attendance_id: attendanceId,
      status: parsedStatus.data,
      accounted_by: context.userId,
    });

    await createAuditLog(context.companyId, {
      action: "emergency.rollcall.attendance_update",
      entity_type: "EvacuationAttendance",
      entity_id: updated.id,
      user_id: context.userId,
      details: {
        site_id: siteId,
        event_id: eventId,
        status: updated.status,
        visitor_name: updated.visitor_name,
      },
      request_id: requestId,
    });

    revalidatePath(siteEmergencyPath(siteId));
    return { success: true, message: "Attendance updated" };
  } catch (error) {
    log.error({ error: String(error) }, "Update roll call attendance failed");
    return { success: false, error: "Failed to update attendance" };
  }
}

export async function markAllRollCallAttendancesAction(
  siteId: string,
  eventId: string,
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

  const guard = await checkSitePermission("site:manage", siteId);
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const entitlementError = await ensureRollCallEnabled({
    companyId: context.companyId,
    siteId,
    requestId,
    log,
  });
  if (entitlementError) {
    return entitlementError;
  }

  try {
    await markAllRollCallAttendancesAccounted(
      context.companyId,
      eventId,
      context.userId,
    );

    await createAuditLog(context.companyId, {
      action: "emergency.rollcall.mark_all_accounted",
      entity_type: "EvacuationEvent",
      entity_id: eventId,
      user_id: context.userId,
      details: { site_id: siteId },
      request_id: requestId,
    });

    revalidatePath(siteEmergencyPath(siteId));
    return { success: true, message: "All visitors marked accounted" };
  } catch (error) {
    log.error({ error: String(error) }, "Mark-all roll call attendance failed");
    return { success: false, error: "Failed to mark all attendance" };
  }
}

export async function closeRollCallEventAction(
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

  const parsed = closeRollCallSchema.safeParse({
    eventId: formData.get("eventId")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const guard = await checkSitePermission("site:manage", siteId);
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const entitlementError = await ensureRollCallEnabled({
    companyId: context.companyId,
    siteId,
    requestId,
    log,
  });
  if (entitlementError) {
    return entitlementError;
  }

  try {
    const closed = await closeRollCallEvent(context.companyId, {
      event_id: parsed.data.eventId,
      closed_by: context.userId,
      notes: parsed.data.notes || undefined,
    });

    await createAuditLog(context.companyId, {
      action: "emergency.rollcall.close",
      entity_type: "EvacuationEvent",
      entity_id: closed.id,
      user_id: context.userId,
      details: {
        site_id: siteId,
        total_people: closed.total_people,
        accounted_count: closed.accounted_count,
        missing_count: closed.missing_count,
      },
      request_id: requestId,
    });

    revalidatePath(siteEmergencyPath(siteId));
    return { success: true, message: "Roll call closed" };
  } catch (error) {
    log.error({ error: String(error) }, "Close roll call failed");
    return { success: false, error: "Failed to close roll call" };
  }
}
