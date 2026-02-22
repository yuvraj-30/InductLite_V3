/**
 * Incident Repository
 *
 * Handles tenant-scoped incident and near-miss capture tied to site and sign-in records.
 */

import { scopedDb } from "@/lib/db/scoped-db";
import type {
  IncidentReport,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  Prisma,
} from "@prisma/client";
import {
  requireCompanyId,
  handlePrismaError,
  normalizePagination,
  paginatedResult,
  RepositoryError,
  type PaginationParams,
  type PaginatedResult,
} from "./base";

export interface IncidentFilter {
  site_id?: string;
  sign_in_record_id?: string;
  incident_type?: IncidentType | IncidentType[];
  severity?: IncidentSeverity | IncidentSeverity[];
  status?: IncidentStatus | IncidentStatus[];
  search?: string;
}

export interface CreateIncidentInput {
  site_id: string;
  sign_in_record_id?: string;
  incident_type?: IncidentType;
  severity?: IncidentSeverity;
  title: string;
  description?: string;
  immediate_actions?: string;
  occurred_at?: Date;
  reported_by?: string;
}

export async function findIncidentReportById(
  companyId: string,
  incidentId: string,
): Promise<IncidentReport | null> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.incidentReport.findFirst({
      where: { id: incidentId, company_id: companyId },
    });
  } catch (error) {
    handlePrismaError(error, "IncidentReport");
  }
}

export async function listIncidentReports(
  companyId: string,
  filter?: IncidentFilter,
  pagination?: PaginationParams,
): Promise<PaginatedResult<IncidentReport>> {
  requireCompanyId(companyId);

  const { skip, take, page, pageSize } = normalizePagination(pagination ?? {});

  const where: Prisma.IncidentReportWhereInput = {
    company_id: companyId,
    ...(filter?.site_id && { site_id: filter.site_id }),
    ...(filter?.sign_in_record_id && {
      sign_in_record_id: filter.sign_in_record_id,
    }),
    ...(filter?.incident_type && {
      incident_type: Array.isArray(filter.incident_type)
        ? { in: filter.incident_type }
        : filter.incident_type,
    }),
    ...(filter?.severity && {
      severity: Array.isArray(filter.severity)
        ? { in: filter.severity }
        : filter.severity,
    }),
    ...(filter?.status && {
      status: Array.isArray(filter.status) ? { in: filter.status } : filter.status,
    }),
    ...(filter?.search && {
      OR: [
        { title: { contains: filter.search, mode: "insensitive" } },
        { description: { contains: filter.search, mode: "insensitive" } },
      ],
    }),
  };

  try {
    const db = scopedDb(companyId);
    const [items, total] = await Promise.all([
      db.incidentReport.findMany({
        where,
        skip,
        take,
        orderBy: [{ occurred_at: "desc" }, { created_at: "desc" }],
      }),
      db.incidentReport.count({ where }),
    ]);

    return paginatedResult(items, total, page, pageSize);
  } catch (error) {
    handlePrismaError(error, "IncidentReport");
  }
}

export async function createIncidentReport(
  companyId: string,
  input: CreateIncidentInput,
): Promise<IncidentReport> {
  requireCompanyId(companyId);

  const title = input.title?.trim();
  if (!title) {
    throw new RepositoryError("Incident title is required", "VALIDATION");
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

    if (input.sign_in_record_id) {
      const signInRecord = await db.signInRecord.findFirst({
        where: { id: input.sign_in_record_id, company_id: companyId },
        select: { id: true, site_id: true },
      });

      if (!signInRecord) {
        throw new RepositoryError("Sign-in record not found", "NOT_FOUND");
      }

      if (signInRecord.site_id !== input.site_id) {
        throw new RepositoryError(
          "Sign-in record does not belong to selected site",
          "VALIDATION",
        );
      }
    }

    return await db.incidentReport.create({
      data: {
        site_id: input.site_id,
        sign_in_record_id: input.sign_in_record_id ?? null,
        incident_type: input.incident_type ?? "INCIDENT",
        severity: input.severity ?? "MEDIUM",
        status: "OPEN",
        title,
        description: input.description?.trim() || null,
        immediate_actions: input.immediate_actions?.trim() || null,
        occurred_at: input.occurred_at ?? new Date(),
        reported_by: input.reported_by ?? null,
      },
    });
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "IncidentReport");
  }
}

export async function resolveIncidentReport(
  companyId: string,
  incidentId: string,
  resolvedBy?: string,
): Promise<IncidentReport> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);

    const updateResult = await db.incidentReport.updateMany({
      where: {
        id: incidentId,
        company_id: companyId,
        status: { not: "CLOSED" },
      },
      data: {
        status: "CLOSED",
        resolved_at: new Date(),
        resolved_by: resolvedBy ?? null,
      },
    });

    if (updateResult.count === 0) {
      const existing = await db.incidentReport.findFirst({
        where: { id: incidentId, company_id: companyId },
        select: { id: true, status: true },
      });

      if (!existing) {
        throw new RepositoryError("Incident report not found", "NOT_FOUND");
      }

      if (existing.status === "CLOSED") {
        throw new RepositoryError("Incident report is already closed", "VALIDATION");
      }
    }

    const updated = await db.incidentReport.findFirst({
      where: { id: incidentId, company_id: companyId },
    });
    if (!updated) {
      throw new RepositoryError("Incident report not found", "NOT_FOUND");
    }

    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "IncidentReport");
  }
}

