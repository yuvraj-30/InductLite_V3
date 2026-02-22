/**
 * Hazard Register Repository
 *
 * Handles tenant-scoped hazard register operations.
 */

import { scopedDb } from "@/lib/db/scoped-db";
import type { HazardRegisterEntry, HazardRiskLevel, HazardStatus, Prisma } from "@prisma/client";
import {
  requireCompanyId,
  handlePrismaError,
  normalizePagination,
  paginatedResult,
  type PaginationParams,
  type PaginatedResult,
  RepositoryError,
} from "./base";

export interface HazardFilter {
  site_id?: string;
  status?: HazardStatus | HazardStatus[];
  risk_level?: HazardRiskLevel | HazardRiskLevel[];
  search?: string;
}

export interface CreateHazardInput {
  site_id: string;
  title: string;
  description?: string;
  risk_level?: HazardRiskLevel;
  controls?: Prisma.InputJsonValue;
  identified_by?: string;
}

export interface UpdateHazardInput {
  title?: string;
  description?: string | null;
  risk_level?: HazardRiskLevel;
  status?: HazardStatus;
  controls?: Prisma.InputJsonValue | null;
}

export async function findHazardById(
  companyId: string,
  hazardId: string,
): Promise<HazardRegisterEntry | null> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.hazardRegisterEntry.findFirst({
      where: { id: hazardId, company_id: companyId },
    });
  } catch (error) {
    handlePrismaError(error, "HazardRegisterEntry");
  }
}

export async function listHazards(
  companyId: string,
  filter?: HazardFilter,
  pagination?: PaginationParams,
): Promise<PaginatedResult<HazardRegisterEntry>> {
  requireCompanyId(companyId);

  const { skip, take, page, pageSize } = normalizePagination(pagination ?? {});
  const where: Prisma.HazardRegisterEntryWhereInput = {
    company_id: companyId,
    ...(filter?.site_id ? { site_id: filter.site_id } : {}),
    ...(filter?.status
      ? { status: Array.isArray(filter.status) ? { in: filter.status } : filter.status }
      : {}),
    ...(filter?.risk_level
      ? {
          risk_level: Array.isArray(filter.risk_level)
            ? { in: filter.risk_level }
            : filter.risk_level,
        }
      : {}),
    ...(filter?.search
      ? {
          OR: [
            { title: { contains: filter.search, mode: "insensitive" } },
            { description: { contains: filter.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  try {
    const db = scopedDb(companyId);
    const [items, total] = await Promise.all([
      db.hazardRegisterEntry.findMany({
        where,
        skip,
        take,
        orderBy: [{ status: "asc" }, { identified_at: "desc" }],
      }),
      db.hazardRegisterEntry.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  } catch (error) {
    handlePrismaError(error, "HazardRegisterEntry");
  }
}

export async function createHazard(
  companyId: string,
  input: CreateHazardInput,
): Promise<HazardRegisterEntry> {
  requireCompanyId(companyId);

  if (!input.site_id) {
    throw new RepositoryError("site_id is required", "VALIDATION");
  }
  if (!input.title?.trim()) {
    throw new RepositoryError("Hazard title is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.hazardRegisterEntry.create({
      data: {
        site_id: input.site_id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        risk_level: input.risk_level ?? "MEDIUM",
        status: "OPEN",
        controls: (input.controls ?? null) as Prisma.InputJsonValue | null,
        identified_by: input.identified_by ?? null,
        identified_at: new Date(),
      },
    });
  } catch (error) {
    handlePrismaError(error, "HazardRegisterEntry");
  }
}

export async function updateHazard(
  companyId: string,
  hazardId: string,
  input: UpdateHazardInput,
): Promise<HazardRegisterEntry> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const updateResult = await db.hazardRegisterEntry.updateMany({
      where: { id: hazardId, company_id: companyId },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.risk_level !== undefined ? { risk_level: input.risk_level } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.controls !== undefined ? { controls: input.controls as Prisma.InputJsonValue | null } : {}),
      },
    });

    if (updateResult.count === 0) {
      throw new RepositoryError("Hazard not found", "NOT_FOUND");
    }

    const updated = await db.hazardRegisterEntry.findFirst({
      where: { id: hazardId, company_id: companyId },
    });
    if (!updated) {
      throw new RepositoryError("Hazard not found", "NOT_FOUND");
    }
    return updated;
  } catch (error) {
    handlePrismaError(error, "HazardRegisterEntry");
  }
}

export async function closeHazard(
  companyId: string,
  hazardId: string,
  closedBy?: string,
): Promise<HazardRegisterEntry> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const result = await db.hazardRegisterEntry.updateMany({
      where: { id: hazardId, company_id: companyId },
      data: {
        status: "CLOSED",
        closed_at: new Date(),
        closed_by: closedBy ?? null,
      },
    });

    if (result.count === 0) {
      throw new RepositoryError("Hazard not found", "NOT_FOUND");
    }

    const updated = await db.hazardRegisterEntry.findFirst({
      where: { id: hazardId, company_id: companyId },
    });
    if (!updated) {
      throw new RepositoryError("Hazard not found", "NOT_FOUND");
    }
    return updated;
  } catch (error) {
    handlePrismaError(error, "HazardRegisterEntry");
  }
}
