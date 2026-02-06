/**
 * Export Job Repository
 *
 * Handles export job operations with tenant scoping.
 */

import { scopedDb } from "@/lib/db/scoped-db";
import { publicDb } from "@/lib/db/public-db";
import type {
  ExportJob,
  ExportStatus,
  ExportType,
  Prisma,
} from "@prisma/client";
import { nanoid } from "nanoid";
import { GUARDRAILS } from "@/lib/guardrails";
import {
  requireCompanyId,
  handlePrismaError,
  normalizePagination,
  paginatedResult,
  type PaginationParams,
  type PaginatedResult,
  RepositoryError,
} from "./base";

export interface CreateExportJobInput {
  export_type: ExportType;
  parameters: Prisma.InputJsonValue;
  requested_by: string;
}

export interface ExportJobFilter {
  status?: ExportStatus | ExportStatus[];
}

export async function countExportJobsSince(
  companyId: string,
  since: Date,
): Promise<number> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.exportJob.count({
      where: { company_id: companyId, queued_at: { gte: since } },
    });
  } catch (error) {
    handlePrismaError(error, "ExportJob");
  }
}

export async function countRunningExportJobs(
  companyId: string,
): Promise<number> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.exportJob.count({
      where: { company_id: companyId, status: "RUNNING" },
    });
  } catch (error) {
    handlePrismaError(error, "ExportJob");
  }
}

export async function countRunningExportJobsGlobal(): Promise<number> {
  try {
    const companies = await publicDb.company.findMany({
      select: { id: true },
    });

    const counts = await Promise.all(
      companies.map((company) =>
        scopedDb(company.id).exportJob.count({
          where: { company_id: company.id, status: "RUNNING" },
        }),
      ),
    );

    return counts.reduce((sum, value) => sum + value, 0);
  } catch (error) {
    handlePrismaError(error, "ExportJob");
  }
}

export async function createExportJob(
  companyId: string,
  input: CreateExportJobInput,
): Promise<ExportJob> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.exportJob.create({
      data: {
        export_type: input.export_type,
        parameters: input.parameters,
        requested_by: input.requested_by,
        status: "QUEUED",
      },
    });
  } catch (error) {
    handlePrismaError(error, "ExportJob");
  }
}

export async function listExportJobs(
  companyId: string,
  filter?: ExportJobFilter,
  pagination?: PaginationParams,
): Promise<PaginatedResult<ExportJob>> {
  requireCompanyId(companyId);

  const { skip, take, page, pageSize } = normalizePagination(pagination ?? {});

  const where: Prisma.ExportJobWhereInput = {
    company_id: companyId,
    ...(filter?.status && {
      status: Array.isArray(filter.status)
        ? { in: filter.status }
        : filter.status,
    }),
  };

  try {
    const db = scopedDb(companyId);
    const [jobs, total] = await Promise.all([
      db.exportJob.findMany({
        where,
        skip,
        take,
        orderBy: { queued_at: "desc" },
      }),
      db.exportJob.count({ where }),
    ]);

    return paginatedResult(jobs, total, page, pageSize);
  } catch (error) {
    handlePrismaError(error, "ExportJob");
  }
}

export async function findNextQueuedExportJob(
  companyId: string,
): Promise<ExportJob | null> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.exportJob.findFirst({
      where: {
        company_id: companyId,
        status: "QUEUED",
        run_at: { lte: new Date() },
      },
      orderBy: { queued_at: "asc" },
    });
  } catch (error) {
    handlePrismaError(error, "ExportJob");
  }
}

/**
 * System-level: claim next queued export job (no tenant scope)
 * Uses optimistic claim (findFirst + updateMany) to avoid raw SQL.
 */
export async function claimNextQueuedExportJob(): Promise<
  (ExportJob & { lock_token?: string; started_at?: Date }) | null
> {
  const now = new Date();

  // Enforce global concurrency in the queue layer
  const running = await countRunningExportJobsGlobal();
  if (running >= GUARDRAILS.MAX_CONCURRENT_EXPORTS_GLOBAL) {
    return null;
  }

  const companies = await publicDb.company.findMany({
    select: { id: true },
  });

  const candidates = await Promise.all(
    companies.map((company) =>
      scopedDb(company.id).exportJob.findFirst({
        where: {
          company_id: company.id,
          status: "QUEUED",
          run_at: { lte: now },
        },
        orderBy: { queued_at: "asc" },
      }),
    ),
  );

  const job = candidates
    .filter((j): j is ExportJob => Boolean(j))
    .sort((a, b) => a.queued_at.getTime() - b.queued_at.getTime())[0];

  if (!job) return null;

  const lockToken = nanoid(16);
  const result = await scopedDb(job.company_id).exportJob.updateMany({
    where: { id: job.id, status: "QUEUED", company_id: job.company_id },
    data: {
      status: "RUNNING",
      started_at: now,
      locked_at: now,
      lock_token: lockToken,
      attempts: { increment: 1 },
    },
  });

  if (result.count === 0) return null;

  return { ...job, lock_token: lockToken, started_at: now };
}

/**
 * System-level: requeue stale RUNNING jobs that exceeded runtime.
 */
export async function requeueStaleExportJobs(): Promise<number> {
  const runtimeMs = GUARDRAILS.MAX_EXPORT_RUNTIME_SECONDS * 1000;
  const staleBefore = new Date(Date.now() - runtimeMs * 2);

  const companies = await publicDb.company.findMany({
    select: { id: true },
  });

  const results = await Promise.all(
    companies.map((company) =>
      scopedDb(company.id).exportJob.updateMany({
        where: {
          company_id: company.id,
          status: "RUNNING",
          started_at: { lt: staleBefore },
          attempts: { lt: GUARDRAILS.MAX_EXPORT_ATTEMPTS },
        },
        data: {
          status: "QUEUED",
          run_at: new Date(),
          locked_at: null,
          lock_token: null,
        },
      }),
    ),
  );

  return results.reduce((sum, result) => sum + result.count, 0);
}

/**
 * System-level: list expired export jobs with files.
 */
export async function listExpiredExportJobs(
  companyId: string,
  limit: number = 100,
): Promise<ExportJob[]> {
  requireCompanyId(companyId);

  return scopedDb(companyId).exportJob.findMany({
    where: {
      company_id: companyId,
      expires_at: { lt: new Date() },
      file_path: { not: null },
    },
    orderBy: { expires_at: "asc" },
    take: limit,
  });
}

/**
 * System-level: delete an export job by ID.
 */
export async function deleteExportJob(
  companyId: string,
  jobId: string,
): Promise<void> {
  requireCompanyId(companyId);
  await scopedDb(companyId).exportJob.deleteMany({
    where: { id: jobId, company_id: companyId },
  });
}

export async function markExportJobRunning(
  companyId: string,
  jobId: string,
): Promise<void> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const result = await db.exportJob.updateMany({
      where: { id: jobId, company_id: companyId, status: "QUEUED" },
      data: { status: "RUNNING", started_at: new Date() },
    });

    if (result.count === 0) {
      throw new RepositoryError(
        "Export job not found or not queued",
        "NOT_FOUND",
      );
    }
  } catch (error) {
    handlePrismaError(error, "ExportJob");
  }
}

export async function markExportJobSucceeded(
  companyId: string,
  jobId: string,
  data: {
    file_path: string;
    file_name: string;
    file_size: number;
    expires_at: Date | null;
  },
): Promise<void> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const result = await db.exportJob.updateMany({
      where: { id: jobId, company_id: companyId },
      data: {
        status: "SUCCEEDED",
        completed_at: new Date(),
        file_path: data.file_path,
        file_name: data.file_name,
        file_size: data.file_size,
        expires_at: data.expires_at,
      },
    });

    if (result.count === 0) {
      throw new RepositoryError("Export job not found", "NOT_FOUND");
    }
  } catch (error) {
    handlePrismaError(error, "ExportJob");
  }
}

export async function markExportJobFailed(
  companyId: string,
  jobId: string,
  errorMessage: string,
): Promise<void> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const result = await db.exportJob.updateMany({
      where: { id: jobId, company_id: companyId },
      data: { status: "FAILED", error_message: errorMessage },
    });

    if (result.count === 0) {
      throw new RepositoryError("Export job not found", "NOT_FOUND");
    }
  } catch (error) {
    handlePrismaError(error, "ExportJob");
  }
}

/**
 * System-level: requeue a job with a delay (no tenant scope).
 */
export async function requeueExportJob(
  companyId: string,
  jobId: string,
  delayMs: number,
): Promise<void> {
  requireCompanyId(companyId);
  const runAt = new Date(Date.now() + Math.max(0, delayMs));

  await scopedDb(companyId).exportJob.updateMany({
    where: { id: jobId, status: "RUNNING", company_id: companyId },
    data: {
      status: "QUEUED",
      run_at: runAt,
      locked_at: null,
      lock_token: null,
      started_at: null,
    },
  });
}

export async function findExportJobById(
  companyId: string,
  jobId: string,
): Promise<ExportJob | null> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.exportJob.findFirst({
      where: { id: jobId, company_id: companyId },
    });
  } catch (error) {
    handlePrismaError(error, "ExportJob");
  }
}
