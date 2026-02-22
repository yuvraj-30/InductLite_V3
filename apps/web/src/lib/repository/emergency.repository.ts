/**
 * Emergency Contacts & Procedures Repository
 *
 * Handles tenant-scoped emergency configuration per site.
 */

import { scopedDb } from "@/lib/db/scoped-db";
import type { SiteEmergencyContact, SiteEmergencyProcedure } from "@prisma/client";
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
