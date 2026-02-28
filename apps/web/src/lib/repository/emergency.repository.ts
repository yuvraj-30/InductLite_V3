/**
 * Emergency Contacts & Procedures Repository
 *
 * Handles tenant-scoped emergency configuration per site.
 */

import { scopedDb } from "@/lib/db/scoped-db";
import { publicDb } from "@/lib/db/public-db";
import type {
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

const DEFAULT_EMERGENCY_DRILL_RETENTION_DAYS = 1825;

function computeRetentionExpiry(days: number, occurredAt: Date): Date {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 1;
  return new Date(occurredAt.getTime() + safeDays * 24 * 60 * 60 * 1000);
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
