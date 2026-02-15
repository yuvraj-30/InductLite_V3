import { publicDb } from "@/lib/db/public-db";
import { GUARDRAILS } from "@/lib/guardrails";
import { deleteObject } from "@/lib/storage";
import { deleteExportJob } from "@/lib/repository/export.repository";
import {
  deleteContractorDocumentById,
} from "@/lib/repository/contractor.repository";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SIGNIN_RETENTION_DAYS = 365;

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;

  const workers = Math.min(Math.max(concurrency, 1), items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (true) {
        const index = nextIndex++;
        if (index >= items.length) return;
        await worker(items[index] as T);
      }
    }),
  );
}

function getRetentionCutoff(days: number, now: Date): Date {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 1;
  return new Date(now.getTime() - safeDays * DAY_MS);
}

export async function runRetentionTasks(): Promise<void> {
  const log = createRequestLogger(generateRequestId());
  const now = new Date();

  // Purge audit logs in one batch (guardrail-based global cutoff)
  const cutoff = new Date(
    Date.now() - GUARDRAILS.AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  try {
    await publicDb.auditLog.deleteMany({
      where: { created_at: { lt: cutoff } },
    });
  } catch (err) {
    log.warn({ err: String(err) }, "Audit purge failed");
  }

  // Purge expired export files + jobs (batch fetch, tenant-safe delete by company+id)
  const expiredExports = await publicDb.exportJob.findMany({
    where: {
      expires_at: { lt: now },
      file_path: { not: null },
    },
    select: { id: true, company_id: true, file_path: true },
    orderBy: { expires_at: "asc" },
    take: 500,
  });

  await runWithConcurrency(expiredExports, 10, async (job) => {
    try {
      if (job.file_path) {
        await deleteObject(job.file_path);
      }
      await deleteExportJob(job.company_id, job.id);
    } catch (err) {
      log.warn(
        { companyId: job.company_id, jobId: job.id, err: String(err) },
        "Export retention cleanup failed",
      );
    }
  });

  // Purge expired contractor documents (batch fetch, tenant-safe delete by company+id)
  const expiredDocs = await publicDb.contractorDocument.findMany({
    where: {
      expires_at: { lt: now },
    },
    select: {
      id: true,
      file_path: true,
      contractor: { select: { company_id: true } },
    },
    orderBy: { expires_at: "asc" },
    take: 500,
  });

  await runWithConcurrency(expiredDocs, 10, async (doc) => {
    try {
      await deleteObject(doc.file_path);
      await deleteContractorDocumentById(doc.contractor.company_id, doc.id);
    } catch (err) {
      log.warn(
        {
          companyId: doc.contractor.company_id,
          documentId: doc.id,
          err: String(err),
        },
        "Document cleanup failed",
      );
    }
  });

  // Purge signed-out sign-in records based on per-company retention policy.
  // InductionResponse rows are cascaded by FK when SignInRecord is deleted.
  const companies = await publicDb.company.findMany({
    select: { id: true, retention_days: true },
  });

  await runWithConcurrency(companies, 10, async (company) => {
    const retentionDays =
      company.retention_days > 0
        ? company.retention_days
        : DEFAULT_SIGNIN_RETENTION_DAYS;
    const cutoff = getRetentionCutoff(retentionDays, now);

    try {
      const deleted = await publicDb.signInRecord.deleteMany({
        where: {
          company_id: company.id,
          sign_out_ts: { lt: cutoff },
        },
      });

      if (deleted.count > 0) {
        log.info(
          {
            companyId: company.id,
            retention_days: retentionDays,
            deleted_count: deleted.count,
          },
          "Sign-in retention cleanup completed",
        );
      }
    } catch (err) {
      log.warn(
        {
          companyId: company.id,
          retention_days: retentionDays,
          err: String(err),
        },
        "Sign-in retention cleanup failed",
      );
    }
  });
}
