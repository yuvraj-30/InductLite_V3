import { publicDb } from "@/lib/db/public-db";
import { GUARDRAILS } from "@/lib/guardrails";
import { deleteObject } from "@/lib/storage";
import { purgeOldAuditLogs } from "@/lib/repository/audit.repository";
import {
  deleteExportJob,
  listExpiredExportJobs,
} from "@/lib/repository/export.repository";
import {
  deleteContractorDocumentById,
  listExpiredContractorDocuments,
} from "@/lib/repository/contractor.repository";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";

export async function runRetentionTasks(): Promise<void> {
  const log = createRequestLogger(generateRequestId());

  // Purge audit logs by company
  const cutoff = new Date(
    Date.now() - GUARDRAILS.AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const companies = await publicDb.company.findMany({
    select: { id: true },
  });

  for (const company of companies) {
    try {
      await purgeOldAuditLogs(company.id, cutoff);
    } catch (err) {
      log.warn(
        { companyId: company.id, err: String(err) },
        "Audit purge failed",
      );
    }
  }

  // Purge expired export files + jobs
  for (const company of companies) {
    const expiredExports = await listExpiredExportJobs(company.id, 200);
    for (const job of expiredExports) {
      try {
        if (job.file_path) {
          await deleteObject(job.file_path);
        }
        await deleteExportJob(company.id, job.id);
      } catch (err) {
        log.warn(
          { companyId: company.id, jobId: job.id, err: String(err) },
          "Export retention cleanup failed",
        );
      }
    }
  }

  // Purge expired contractor documents
  for (const company of companies) {
    const expiredDocs = await listExpiredContractorDocuments(company.id, 200);
    for (const doc of expiredDocs) {
      try {
        await deleteObject(doc.file_path);
        await deleteContractorDocumentById(company.id, doc.id);
      } catch (err) {
        log.warn(
          { companyId: company.id, documentId: doc.id, err: String(err) },
          "Document cleanup failed",
        );
      }
    }
  }
}
