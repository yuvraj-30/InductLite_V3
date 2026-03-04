/**
 * Emergency Contacts & Procedures Repository
 *
 * Handles tenant-scoped emergency configuration per site.
 */

import { scopedDb } from "@/lib/db/scoped-db";
import { publicDb } from "@/lib/db/public-db";
import type {
  EvacuationAttendance,
  EvacuationAttendanceStatus,
  EvacuationEvent,
  EmergencyDrill,
  EmergencyDrillType,
  SiteEmergencyContact,
  SiteEmergencyProcedure,
} from "@prisma/client";
import {
  requireCompanyId,
  handlePrismaError,
  RepositoryError,
} from "./base";

export interface CreateEmergencyContactInput {
  site_id: string;
  name: string;
  role?: string;
  phone: string;
  email?: string;
  notes?: string;
  priority?: number;
}

export interface UpdateEmergencyContactInput {
  name?: string;
  role?: string | null;
  phone?: string;
  email?: string | null;
  notes?: string | null;
  priority?: number;
  is_active?: boolean;
}

export interface CreateEmergencyProcedureInput {
  site_id: string;
  title: string;
  instructions: string;
  sort_order?: number;
}

export interface UpdateEmergencyProcedureInput {
  title?: string;
  instructions?: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface CreateEmergencyDrillInput {
  site_id: string;
  drill_type?: EmergencyDrillType;
  scenario: string;
  outcome_notes?: string;
  follow_up_actions?: string;
  conducted_at?: Date;
  next_due_at?: Date;
  tested_by?: string;
  legal_hold?: boolean;
}

export interface StartRollCallEventInput {
  site_id: string;
  started_by?: string;
}

export interface UpdateRollCallAttendanceInput {
  event_id: string;
  attendance_id: string;
  status: EvacuationAttendanceStatus;
  accounted_by?: string;
}

export interface CloseRollCallEventInput {
  event_id: string;
  closed_by?: string;
  notes?: string;
}

const DEFAULT_EMERGENCY_DRILL_RETENTION_DAYS = 1825;

function computeRetentionExpiry(days: number, occurredAt: Date): Date {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 1;
  return new Date(occurredAt.getTime() + safeDays * 24 * 60 * 60 * 1000);
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

export async function listSiteEmergencyContacts(
  companyId: string,
  siteId: string,
): Promise<SiteEmergencyContact[]> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.siteEmergencyContact.findMany({
      where: { company_id: companyId, site_id: siteId, is_active: true },
      orderBy: [{ priority: "asc" }, { created_at: "asc" }],
    });
  } catch (error) {
    handlePrismaError(error, "SiteEmergencyContact");
  }
}

export async function createSiteEmergencyContact(
  companyId: string,
  input: CreateEmergencyContactInput,
): Promise<SiteEmergencyContact> {
  requireCompanyId(companyId);

  if (!input.site_id) {
    throw new RepositoryError("site_id is required", "VALIDATION");
  }
  if (!input.name?.trim()) {
    throw new RepositoryError("Contact name is required", "VALIDATION");
  }
  if (!input.phone?.trim()) {
    throw new RepositoryError("Contact phone is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.siteEmergencyContact.create({
      data: {
        site_id: input.site_id,
        name: input.name.trim(),
        role: input.role?.trim() || null,
        phone: input.phone.trim(),
        email: input.email?.trim() || null,
        notes: input.notes?.trim() || null,
        priority: input.priority ?? 0,
      },
    });
  } catch (error) {
    handlePrismaError(error, "SiteEmergencyContact");
  }
}

export async function updateSiteEmergencyContact(
  companyId: string,
  contactId: string,
  input: UpdateEmergencyContactInput,
): Promise<SiteEmergencyContact> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const result = await db.siteEmergencyContact.updateMany({
      where: { id: contactId, company_id: companyId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      },
    });

    if (result.count === 0) {
      throw new RepositoryError("Emergency contact not found", "NOT_FOUND");
    }

    const updated = await db.siteEmergencyContact.findFirst({
      where: { id: contactId, company_id: companyId },
    });
    if (!updated) {
      throw new RepositoryError("Emergency contact not found", "NOT_FOUND");
    }
    return updated;
  } catch (error) {
    handlePrismaError(error, "SiteEmergencyContact");
  }
}

export async function deactivateSiteEmergencyContact(
  companyId: string,
  contactId: string,
): Promise<void> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    await db.siteEmergencyContact.updateMany({
      where: { id: contactId, company_id: companyId },
      data: { is_active: false },
    });
  } catch (error) {
    handlePrismaError(error, "SiteEmergencyContact");
  }
}

export async function listSiteEmergencyProcedures(
  companyId: string,
  siteId: string,
): Promise<SiteEmergencyProcedure[]> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.siteEmergencyProcedure.findMany({
      where: { company_id: companyId, site_id: siteId, is_active: true },
      orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    });
  } catch (error) {
    handlePrismaError(error, "SiteEmergencyProcedure");
  }
}

export async function createSiteEmergencyProcedure(
  companyId: string,
  input: CreateEmergencyProcedureInput,
): Promise<SiteEmergencyProcedure> {
  requireCompanyId(companyId);

  if (!input.site_id) {
    throw new RepositoryError("site_id is required", "VALIDATION");
  }
  if (!input.title?.trim()) {
    throw new RepositoryError("Procedure title is required", "VALIDATION");
  }
  if (!input.instructions?.trim()) {
    throw new RepositoryError("Procedure instructions are required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.siteEmergencyProcedure.create({
      data: {
        site_id: input.site_id,
        title: input.title.trim(),
        instructions: input.instructions.trim(),
        sort_order: input.sort_order ?? 0,
        is_active: true,
      },
    });
  } catch (error) {
    handlePrismaError(error, "SiteEmergencyProcedure");
  }
}

export async function updateSiteEmergencyProcedure(
  companyId: string,
  procedureId: string,
  input: UpdateEmergencyProcedureInput,
): Promise<SiteEmergencyProcedure> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const result = await db.siteEmergencyProcedure.updateMany({
      where: { id: procedureId, company_id: companyId },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.instructions !== undefined
          ? { instructions: input.instructions.trim() }
          : {}),
        ...(input.sort_order !== undefined ? { sort_order: input.sort_order } : {}),
        ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      },
    });

    if (result.count === 0) {
      throw new RepositoryError("Emergency procedure not found", "NOT_FOUND");
    }

    const updated = await db.siteEmergencyProcedure.findFirst({
      where: { id: procedureId, company_id: companyId },
    });
    if (!updated) {
      throw new RepositoryError("Emergency procedure not found", "NOT_FOUND");
    }
    return updated;
  } catch (error) {
    handlePrismaError(error, "SiteEmergencyProcedure");
  }
}

export async function deactivateSiteEmergencyProcedure(
  companyId: string,
  procedureId: string,
): Promise<void> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    await db.siteEmergencyProcedure.updateMany({
      where: { id: procedureId, company_id: companyId },
      data: { is_active: false },
    });
  } catch (error) {
    handlePrismaError(error, "SiteEmergencyProcedure");
  }
}

export async function listEmergencyDrills(
  companyId: string,
  siteId: string,
): Promise<EmergencyDrill[]> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.emergencyDrill.findMany({
      where: { company_id: companyId, site_id: siteId },
      orderBy: [{ conducted_at: "desc" }, { created_at: "desc" }],
    });
  } catch (error) {
    handlePrismaError(error, "EmergencyDrill");
  }
}

export async function createEmergencyDrill(
  companyId: string,
  input: CreateEmergencyDrillInput,
): Promise<EmergencyDrill> {
  requireCompanyId(companyId);

  if (!input.site_id) {
    throw new RepositoryError("site_id is required", "VALIDATION");
  }
  if (!input.scenario?.trim()) {
    throw new RepositoryError("Drill scenario is required", "VALIDATION");
  }

  const conductedAt = input.conducted_at ?? new Date();
  if (Number.isNaN(conductedAt.getTime())) {
    throw new RepositoryError("Invalid conducted_at timestamp", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);

    const site = await db.site.findFirst({
      where: { id: input.site_id, company_id: companyId },
      select: { id: true },
    });
    if (!site) {
      throw new RepositoryError("Site not found", "NOT_FOUND");
    }

    if (input.tested_by) {
      const tester = await db.user.findFirst({
        where: { id: input.tested_by, company_id: companyId },
        select: { id: true },
      });
      if (!tester) {
        throw new RepositoryError("Drill tester not found", "NOT_FOUND");
      }
    }

    const company = await publicDb.company.findFirst({
      where: { id: companyId },
      select: {
        emergency_drill_retention_days: true,
        compliance_legal_hold: true,
      },
    });
    const retentionDays =
      company?.emergency_drill_retention_days &&
      company.emergency_drill_retention_days > 0
        ? company.emergency_drill_retention_days
        : DEFAULT_EMERGENCY_DRILL_RETENTION_DAYS;

    return await db.emergencyDrill.create({
      data: {
        site_id: input.site_id,
        drill_type: input.drill_type ?? "EVACUATION",
        scenario: input.scenario.trim(),
        outcome_notes: input.outcome_notes?.trim() || null,
        follow_up_actions: input.follow_up_actions?.trim() || null,
        conducted_at: conductedAt,
        next_due_at: input.next_due_at ?? null,
        tested_by: input.tested_by ?? null,
        legal_hold: input.legal_hold ?? company?.compliance_legal_hold ?? false,
        retention_expires_at: computeRetentionExpiry(retentionDays, conductedAt),
      },
    });
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "EmergencyDrill");
  }
}

async function recomputeRollCallCounts(
  companyId: string,
  eventId: string,
): Promise<{ total: number; accounted: number; missing: number }> {
  const db = scopedDb(companyId);
  const [total, accounted] = await Promise.all([
    db.evacuationAttendance.count({
      where: { company_id: companyId, event_id: eventId },
    }),
    db.evacuationAttendance.count({
      where: {
        company_id: companyId,
        event_id: eventId,
        status: "ACCOUNTED",
      },
    }),
  ]);
  const missing = Math.max(total - accounted, 0);
  await db.evacuationEvent.updateMany({
    where: { company_id: companyId, id: eventId },
    data: {
      total_people: total,
      accounted_count: accounted,
      missing_count: missing,
    },
  });
  return { total, accounted, missing };
}

export async function findActiveRollCallEvent(
  companyId: string,
  siteId: string,
): Promise<EvacuationEvent | null> {
  requireCompanyId(companyId);
  try {
    const db = scopedDb(companyId);
    return await db.evacuationEvent.findFirst({
      where: {
        company_id: companyId,
        site_id: siteId,
        status: "ACTIVE",
      },
      orderBy: { started_at: "desc" },
    });
  } catch (error) {
    handlePrismaError(error, "EvacuationEvent");
  }
}

export async function listRollCallEvents(
  companyId: string,
  siteId: string,
  limit: number = 20,
): Promise<EvacuationEvent[]> {
  requireCompanyId(companyId);
  try {
    const db = scopedDb(companyId);
    return await db.evacuationEvent.findMany({
      where: { company_id: companyId, site_id: siteId },
      orderBy: [{ started_at: "desc" }, { created_at: "desc" }],
      take: Math.max(1, Math.min(limit, 100)),
    });
  } catch (error) {
    handlePrismaError(error, "EvacuationEvent");
  }
}

export async function listRollCallAttendances(
  companyId: string,
  eventId: string,
): Promise<EvacuationAttendance[]> {
  requireCompanyId(companyId);
  try {
    const db = scopedDb(companyId);
    return await db.evacuationAttendance.findMany({
      where: { company_id: companyId, event_id: eventId },
      orderBy: [{ status: "asc" }, { visitor_name: "asc" }, { created_at: "asc" }],
    });
  } catch (error) {
    handlePrismaError(error, "EvacuationAttendance");
  }
}

export async function startRollCallEvent(
  companyId: string,
  input: StartRollCallEventInput,
): Promise<EvacuationEvent> {
  requireCompanyId(companyId);

  if (!input.site_id) {
    throw new RepositoryError("site_id is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    const site = await db.site.findFirst({
      where: { id: input.site_id, company_id: companyId },
      select: { id: true },
    });
    if (!site) {
      throw new RepositoryError("Site not found", "NOT_FOUND");
    }

    const existing = await db.evacuationEvent.findFirst({
      where: {
        company_id: companyId,
        site_id: input.site_id,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (existing) {
      throw new RepositoryError("An active roll call already exists", "VALIDATION");
    }

    const onSiteRecords = await db.signInRecord.findMany({
      where: {
        company_id: companyId,
        site_id: input.site_id,
        sign_out_ts: null,
      },
      select: {
        id: true,
        visitor_name: true,
        visitor_type: true,
      },
    });

    const event = await db.evacuationEvent.create({
      data: {
        site_id: input.site_id,
        status: "ACTIVE",
        started_by: input.started_by ?? null,
        total_people: onSiteRecords.length,
        accounted_count: 0,
        missing_count: onSiteRecords.length,
      },
    });

    if (onSiteRecords.length > 0) {
      await Promise.all(
        onSiteRecords.map((record) =>
          db.evacuationAttendance.create({
            data: {
              event_id: event.id,
              site_id: input.site_id,
              sign_in_record_id: record.id,
              visitor_name: record.visitor_name,
              visitor_type: record.visitor_type,
              status: "MISSING",
            },
          }),
        ),
      );
    }

    return event;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "EvacuationEvent");
  }
}

export async function updateRollCallAttendance(
  companyId: string,
  input: UpdateRollCallAttendanceInput,
): Promise<EvacuationAttendance> {
  requireCompanyId(companyId);
  if (!input.event_id || !input.attendance_id) {
    throw new RepositoryError("event_id and attendance_id are required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);

    const event = await db.evacuationEvent.findFirst({
      where: {
        company_id: companyId,
        id: input.event_id,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (!event) {
      throw new RepositoryError("Active roll call event not found", "NOT_FOUND");
    }

    const accountedAt = input.status === "ACCOUNTED" ? new Date() : null;
    const accountedBy = input.status === "ACCOUNTED" ? input.accounted_by ?? null : null;
    const result = await db.evacuationAttendance.updateMany({
      where: {
        company_id: companyId,
        event_id: input.event_id,
        id: input.attendance_id,
      },
      data: {
        status: input.status,
        accounted_at: accountedAt,
        accounted_by: accountedBy,
      },
    });
    if (result.count === 0) {
      throw new RepositoryError("Roll call attendance not found", "NOT_FOUND");
    }

    const updated = await db.evacuationAttendance.findFirst({
      where: {
        company_id: companyId,
        event_id: input.event_id,
        id: input.attendance_id,
      },
    });
    if (!updated) {
      throw new RepositoryError("Roll call attendance not found", "NOT_FOUND");
    }

    await recomputeRollCallCounts(companyId, input.event_id);
    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "EvacuationAttendance");
  }
}

export async function markAllRollCallAttendancesAccounted(
  companyId: string,
  eventId: string,
  accountedBy?: string,
): Promise<void> {
  requireCompanyId(companyId);
  if (!eventId) {
    throw new RepositoryError("event_id is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    const event = await db.evacuationEvent.findFirst({
      where: {
        company_id: companyId,
        id: eventId,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (!event) {
      throw new RepositoryError("Active roll call event not found", "NOT_FOUND");
    }

    await db.evacuationAttendance.updateMany({
      where: { company_id: companyId, event_id: eventId },
      data: {
        status: "ACCOUNTED",
        accounted_at: new Date(),
        accounted_by: accountedBy ?? null,
      },
    });

    await recomputeRollCallCounts(companyId, eventId);
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "EvacuationAttendance");
  }
}

export async function closeRollCallEvent(
  companyId: string,
  input: CloseRollCallEventInput,
): Promise<EvacuationEvent> {
  requireCompanyId(companyId);
  if (!input.event_id) {
    throw new RepositoryError("event_id is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    const event = await db.evacuationEvent.findFirst({
      where: {
        company_id: companyId,
        id: input.event_id,
      },
    });
    if (!event) {
      throw new RepositoryError("Roll call event not found", "NOT_FOUND");
    }
    if (event.status === "CLOSED") {
      return event;
    }

    const counts = await recomputeRollCallCounts(companyId, input.event_id);
    const closeTime = new Date();
    await db.evacuationEvent.updateMany({
      where: { company_id: companyId, id: input.event_id, status: "ACTIVE" },
      data: {
        status: "CLOSED",
        closed_at: closeTime,
        closed_by: input.closed_by ?? null,
        notes: input.notes?.trim() || null,
        total_people: counts.total,
        accounted_count: counts.accounted,
        missing_count: counts.missing,
      },
    });

    const closed = await db.evacuationEvent.findFirst({
      where: { company_id: companyId, id: input.event_id },
    });
    if (!closed) {
      throw new RepositoryError("Roll call event not found", "NOT_FOUND");
    }
    return closed;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "EvacuationEvent");
  }
}

export async function getRollCallEventExportCsv(
  companyId: string,
  eventId: string,
): Promise<{ fileName: string; csv: string; siteId: string }> {
  requireCompanyId(companyId);
  if (!eventId) {
    throw new RepositoryError("event_id is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    const event = await db.evacuationEvent.findFirst({
      where: { company_id: companyId, id: eventId },
      include: { site: { select: { name: true } } },
    });
    if (!event) {
      throw new RepositoryError("Roll call event not found", "NOT_FOUND");
    }

    const attendances = await db.evacuationAttendance.findMany({
      where: { company_id: companyId, event_id: eventId },
      orderBy: [{ status: "asc" }, { visitor_name: "asc" }],
    });

    const header = [
      "event_id",
      "site_name",
      "event_status",
      "started_at",
      "closed_at",
      "visitor_name",
      "visitor_type",
      "attendance_status",
      "accounted_at",
    ].join(",");

    const rows = attendances.map((item) =>
      [
        escapeCsv(event.id),
        escapeCsv(event.site.name),
        escapeCsv(event.status),
        escapeCsv(event.started_at.toISOString()),
        escapeCsv(event.closed_at ? event.closed_at.toISOString() : ""),
        escapeCsv(item.visitor_name),
        escapeCsv(item.visitor_type),
        escapeCsv(item.status),
        escapeCsv(item.accounted_at ? item.accounted_at.toISOString() : ""),
      ].join(","),
    );

    const csv = [header, ...rows].join("\n");
    const fileDate = event.started_at.toISOString().slice(0, 10);
    const fileName = `roll-call-${event.site_id}-${fileDate}.csv`;
    return { fileName, csv, siteId: event.site_id };
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "EvacuationEvent");
  }
}
