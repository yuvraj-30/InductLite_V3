/**
 * Export Job Repository
 *
 * Handles export job operations with tenant scoping.
 */

import { scopedDb } from "@/lib/db/scoped-db";
import { publicDb } from "@/lib/db/public-db";
import {
  aggregateSucceededExportJobBytesSince,
  countRunningExportJobsGlobal as countRunningExportJobsGlobalUnsafe,
  findOldestQueuedExportJob,
  listExportJobsQueuedSince,
  listGlobalExportDownloadAuditLogsSince,
  requeueStaleRunningExportJobs,
} from "@/lib/db/scoped";
import { Prisma } from "@prisma/client";
import type { ExportJob, ExportStatus, ExportType } from "@prisma/client";
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

export class ExportLimitReachedError extends Error {
  constructor() {
    super("Export limits reached");
    this.name = "ExportLimitReachedError";
  }
}

export class ExportGlobalBytesLimitReachedError extends Error {
  constructor() {
    super("Global export byte budget reached");
    this.name = "ExportGlobalBytesLimitReachedError";
  }
}

export class ExportQueueAgeLimitReachedError extends Error {
  constructor(public readonly oldestQueuedAgeMinutes: number) {
    super("Export queue age limit reached");
    this.name = "ExportQueueAgeLimitReachedError";
  }
}

export interface ExportOffPeakDecision {
  active: boolean;
  reason: "disabled" | "static" | "auto";
  thresholdPercent: number;
  queueDelaySeconds: number;
  windowDays: number;
  delayedJobs: number;
  observedJobs: number;
  delayedPercent: number;
}

export type ExportDownloadGuardrailResult =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      controlId: "EXPT-003" | "EXPT-004";
      violatedLimit: string;
      scope: "tenant" | "environment";
      message: string;
    };

const MAX_SERIALIZABLE_RETRIES = 3;

function utcDayStart(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function parseDownloadBytes(details: Prisma.JsonValue | null | undefined): number {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return 0;
  }

  const raw = (details as Record<string, unknown>).download_bytes;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }

  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return 0;
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function getQueueDelaySeconds(input: {
  queuedAt: Date;
  startedAt: Date | null;
  now: Date;
}): number {
  const effectiveStart = input.startedAt ?? input.now;
  const delayMs = Math.max(0, effectiveStart.getTime() - input.queuedAt.getTime());
  return delayMs / 1000;
}

export async function getOldestQueuedExportAgeMinutes(
  now: Date = new Date(),
): Promise<number | null> {
  const oldestQueuedJob = await findOldestQueuedExportJob(now);
  if (!oldestQueuedJob) {
    return null;
  }

  return (now.getTime() - oldestQueuedJob.queued_at.getTime()) / (60 * 1000);
}

export async function getExportOffPeakDecision(
  now: Date = new Date(),
): Promise<ExportOffPeakDecision> {
  if (GUARDRAILS.EXPORT_OFFPEAK_ONLY) {
    return {
      active: true,
      reason: "static",
      thresholdPercent: GUARDRAILS.EXPORT_OFFPEAK_AUTO_ENABLE_THRESHOLD_PERCENT,
      queueDelaySeconds: GUARDRAILS.EXPORT_OFFPEAK_AUTO_ENABLE_QUEUE_DELAY_SECONDS,
      windowDays: GUARDRAILS.EXPORT_OFFPEAK_AUTO_ENABLE_DAYS,
      delayedJobs: 0,
      observedJobs: 0,
      delayedPercent: 0,
    };
  }

  const windowStart = new Date(
    now.getTime() -
      GUARDRAILS.EXPORT_OFFPEAK_AUTO_ENABLE_DAYS * 24 * 60 * 60 * 1000,
  );
  const jobs = await listExportJobsQueuedSince(windowStart);
  if (jobs.length === 0) {
    return {
      active: false,
      reason: "disabled",
      thresholdPercent: GUARDRAILS.EXPORT_OFFPEAK_AUTO_ENABLE_THRESHOLD_PERCENT,
      queueDelaySeconds: GUARDRAILS.EXPORT_OFFPEAK_AUTO_ENABLE_QUEUE_DELAY_SECONDS,
      windowDays: GUARDRAILS.EXPORT_OFFPEAK_AUTO_ENABLE_DAYS,
      delayedJobs: 0,
      observedJobs: 0,
      delayedPercent: 0,
    };
  }

  const delayedJobs = jobs.filter((job) => {
    return (
      getQueueDelaySeconds({
        queuedAt: job.queued_at,
        startedAt: job.started_at,
        now,
      }) >= GUARDRAILS.EXPORT_OFFPEAK_AUTO_ENABLE_QUEUE_DELAY_SECONDS
    );
  }).length;
  const delayedPercent = roundToTwoDecimals((delayedJobs / jobs.length) * 100);

  return {
    active:
      delayedPercent >= GUARDRAILS.EXPORT_OFFPEAK_AUTO_ENABLE_THRESHOLD_PERCENT,
    reason:
      delayedPercent >= GUARDRAILS.EXPORT_OFFPEAK_AUTO_ENABLE_THRESHOLD_PERCENT
        ? "auto"
        : "disabled",
    thresholdPercent: GUARDRAILS.EXPORT_OFFPEAK_AUTO_ENABLE_THRESHOLD_PERCENT,
    queueDelaySeconds: GUARDRAILS.EXPORT_OFFPEAK_AUTO_ENABLE_QUEUE_DELAY_SECONDS,
    windowDays: GUARDRAILS.EXPORT_OFFPEAK_AUTO_ENABLE_DAYS,
    delayedJobs,
    observedJobs: jobs.length,
    delayedPercent,
  };
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
    return await countRunningExportJobsGlobalUnsafe();
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

/**
 * Queue an export job while enforcing per-company limits atomically.
 */
export async function queueExportJobWithLimits(
  companyId: string,
  input: CreateExportJobInput,
): Promise<ExportJob> {
  requireCompanyId(companyId);

  await failQueuedExportJobsExceedingAgeLimit();
  const since = utcDayStart();
  const oldestQueuedAgeMinutes = await getOldestQueuedExportAgeMinutes();
  if (
    oldestQueuedAgeMinutes !== null &&
    oldestQueuedAgeMinutes > GUARDRAILS.MAX_EXPORT_QUEUE_AGE_MINUTES
  ) {
    throw new ExportQueueAgeLimitReachedError(oldestQueuedAgeMinutes);
  }

  for (let attempt = 1; attempt <= MAX_SERIALIZABLE_RETRIES; attempt++) {
    try {
      return await publicDb.$transaction(
        async (tx) => {
          const db = scopedDb(companyId, tx);
          const [exportsToday, runningNow, globalGeneratedBytesResult] =
            await Promise.all([
            db.exportJob.count({
              where: {
                company_id: companyId,
                queued_at: { gte: since },
              },
            }),
            db.exportJob.count({
              where: {
                company_id: companyId,
                status: "RUNNING",
              },
            }),
            aggregateSucceededExportJobBytesSince(since, tx),
          ]);

          if (
            exportsToday >= GUARDRAILS.MAX_EXPORTS_PER_COMPANY_PER_DAY ||
            runningNow >= GUARDRAILS.MAX_CONCURRENT_EXPORTS_PER_COMPANY
          ) {
            throw new ExportLimitReachedError();
          }

          const globalGeneratedBytes =
            globalGeneratedBytesResult._sum.file_size ?? 0;
          // Conservative admission check: each queued export can consume up to MAX_EXPORT_BYTES.
          if (
            globalGeneratedBytes + GUARDRAILS.MAX_EXPORT_BYTES >
            GUARDRAILS.MAX_EXPORT_BYTES_GLOBAL_PER_DAY
          ) {
            throw new ExportGlobalBytesLimitReachedError();
          }

          return db.exportJob.create({
            data: {
              export_type: input.export_type,
              parameters: input.parameters,
              requested_by: input.requested_by,
              status: "QUEUED",
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const isSerializationConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034";

      if (error instanceof ExportLimitReachedError) {
        throw error;
      }
      if (error instanceof ExportGlobalBytesLimitReachedError) {
        throw error;
      }
      if (error instanceof ExportQueueAgeLimitReachedError) {
        throw error;
      }

      if (isSerializationConflict && attempt < MAX_SERIALIZABLE_RETRIES) {
        continue;
      }

      handlePrismaError(error, "ExportJob");
    }
  }

  throw new RepositoryError("Failed to queue export job", "DATABASE_ERROR");
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

export async function failQueuedExportJobsExceedingAgeLimit(
  now: Date = new Date(),
): Promise<
  Array<{
    id: string;
    company_id: string;
    oldestQueuedAgeMinutes: number;
  }>
> {
  const expiredJobs: Array<{
    id: string;
    company_id: string;
    oldestQueuedAgeMinutes: number;
  }> = [];

  while (true) {
    const oldestQueuedJob = await findOldestQueuedExportJob(now);
    if (!oldestQueuedJob) {
      return expiredJobs;
    }

    const oldestQueuedAgeMinutes =
      (now.getTime() - oldestQueuedJob.queued_at.getTime()) / (60 * 1000);

    if (oldestQueuedAgeMinutes <= GUARDRAILS.MAX_EXPORT_QUEUE_AGE_MINUTES) {
      return expiredJobs;
    }

    const result = await scopedDb(oldestQueuedJob.company_id).exportJob.updateMany({
      where: {
        id: oldestQueuedJob.id,
        status: "QUEUED",
        company_id: oldestQueuedJob.company_id,
      },
      data: {
        status: "FAILED",
        completed_at: now,
        error_message: `Export queue age exceeded MAX_EXPORT_QUEUE_AGE_MINUTES (${roundToTwoDecimals(oldestQueuedAgeMinutes)}m > ${GUARDRAILS.MAX_EXPORT_QUEUE_AGE_MINUTES}m)`,
      },
    });

    if (result.count === 0) {
      continue;
    }

    expiredJobs.push({
      id: oldestQueuedJob.id,
      company_id: oldestQueuedJob.company_id,
      oldestQueuedAgeMinutes,
    });
  }
}

/**
 * System-level: claim next queued export job (no tenant scope)
 * Uses optimistic claim (findFirst + updateMany) to avoid raw SQL.
 */
export async function claimNextQueuedExportJob(
  companyId?: string,
): Promise<
  (ExportJob & { lock_token?: string; started_at?: Date }) | null
> {
  const now = new Date();

  // Enforce global concurrency in the queue layer
  const running = await countRunningExportJobsGlobal();
  if (running >= GUARDRAILS.MAX_CONCURRENT_EXPORTS_GLOBAL) {
    return null;
  }

  const job = companyId
    ? await findNextQueuedExportJob(companyId)
    : await findOldestQueuedExportJob(now);

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
  const result = await requeueStaleRunningExportJobs({
    staleBefore,
    maxAttempts: GUARDRAILS.MAX_EXPORT_ATTEMPTS,
  });

  return result.count;
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

export async function checkExportDownloadGuardrails(
  companyId: string,
  downloadBytes: number,
): Promise<ExportDownloadGuardrailResult> {
  requireCompanyId(companyId);

  if (!Number.isFinite(downloadBytes) || downloadBytes <= 0) {
    return { allowed: true };
  }

  const since = utcDayStart();
  const db = scopedDb(companyId);

  const [tenantLogs, globalLogs] = await Promise.all([
    db.auditLog.findMany({
      where: {
        company_id: companyId,
        action: "export.download",
        created_at: { gte: since },
      },
      select: { details: true },
    }),
    listGlobalExportDownloadAuditLogsSince(since),
  ]);

  const tenantUsed = tenantLogs.reduce(
    (sum, item) => sum + parseDownloadBytes(item.details),
    0,
  );
  if (
    tenantUsed + downloadBytes >
    GUARDRAILS.MAX_EXPORT_DOWNLOAD_BYTES_PER_COMPANY_PER_DAY
  ) {
    return {
      allowed: false,
      controlId: "EXPT-003",
      violatedLimit: `MAX_EXPORT_DOWNLOAD_BYTES_PER_COMPANY_PER_DAY=${GUARDRAILS.MAX_EXPORT_DOWNLOAD_BYTES_PER_COMPANY_PER_DAY}`,
      scope: "tenant",
      message: "Daily company export download limit reached.",
    };
  }

  const globalUsed = globalLogs.reduce(
    (sum, item) => sum + parseDownloadBytes(item.details),
    0,
  );
  if (
    globalUsed + downloadBytes >
    GUARDRAILS.MAX_EXPORT_DOWNLOAD_BYTES_GLOBAL_PER_DAY
  ) {
    return {
      allowed: false,
      controlId: "EXPT-004",
      violatedLimit: `MAX_EXPORT_DOWNLOAD_BYTES_GLOBAL_PER_DAY=${GUARDRAILS.MAX_EXPORT_DOWNLOAD_BYTES_GLOBAL_PER_DAY}`,
      scope: "environment",
      message: "Global export download limit reached.",
    };
  }

  return { allowed: true };
}
