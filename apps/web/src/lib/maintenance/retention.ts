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
const DEFAULT_INDUCTION_RETENTION_DAYS = 365;
const DEFAULT_AUDIT_RETENTION_DAYS = 90;
const DEFAULT_INCIDENT_RETENTION_DAYS = 1825;
const DEFAULT_EMERGENCY_DRILL_RETENTION_DAYS = 1825;

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
    select: {
      id: true,
      retention_days: true,
      induction_retention_days: true,
      audit_retention_days: true,
      incident_retention_days: true,
      emergency_drill_retention_days: true,
      compliance_legal_hold: true,
    },
  });

  await runWithConcurrency(companies, 10, async (company) => {
    const signInRetentionDays =
      company.retention_days > 0
        ? company.retention_days
        : DEFAULT_SIGNIN_RETENTION_DAYS;
    const inductionRetentionDays =
      company.induction_retention_days > 0
        ? company.induction_retention_days
        : DEFAULT_INDUCTION_RETENTION_DAYS;
    const signInEvidenceRetentionDays = Math.max(
      signInRetentionDays,
      inductionRetentionDays,
    );
    const signInCutoff = getRetentionCutoff(signInEvidenceRetentionDays, now);

    if (company.compliance_legal_hold) {
      log.info(
        { companyId: company.id },
        "Skipping sign-in, incident, drill, and audit retention due to company compliance legal hold",
      );
      return;
    }

    try {
      const deleted = await publicDb.signInRecord.deleteMany({
        where: {
          company_id: company.id,
          sign_out_ts: { lt: signInCutoff },
        },
      });

      if (deleted.count > 0) {
        log.info(
          {
            companyId: company.id,
            sign_in_retention_days: signInRetentionDays,
            induction_retention_days: inductionRetentionDays,
            retention_days: signInEvidenceRetentionDays,
            deleted_count: deleted.count,
          },
          "Sign-in retention cleanup completed",
        );
      }
    } catch (err) {
      log.warn(
        {
          companyId: company.id,
          sign_in_retention_days: signInRetentionDays,
          induction_retention_days: inductionRetentionDays,
          retention_days: signInEvidenceRetentionDays,
          err: String(err),
        },
        "Sign-in retention cleanup failed",
      );
    }

    const auditRetentionDays =
      company.audit_retention_days > 0
        ? company.audit_retention_days
        : DEFAULT_AUDIT_RETENTION_DAYS;
    const auditRetentionFloor =
      GUARDRAILS.AUDIT_RETENTION_DAYS > 0
        ? GUARDRAILS.AUDIT_RETENTION_DAYS
        : DEFAULT_AUDIT_RETENTION_DAYS;
    const effectiveAuditRetentionDays = Math.max(
      auditRetentionDays,
      auditRetentionFloor,
    );
    const auditCutoff = getRetentionCutoff(effectiveAuditRetentionDays, now);

    try {
      const auditDeleted = await publicDb.auditLog.deleteMany({
        where: {
          company_id: company.id,
          created_at: { lt: auditCutoff },
        },
      });

      if (auditDeleted.count > 0) {
        log.info(
          {
            companyId: company.id,
            audit_retention_days: effectiveAuditRetentionDays,
            deleted_count: auditDeleted.count,
          },
          "Audit retention cleanup completed",
        );
      }
    } catch (err) {
      log.warn(
        {
          companyId: company.id,
          audit_retention_days: effectiveAuditRetentionDays,
          err: String(err),
        },
        "Audit retention cleanup failed",
      );
    }

    const incidentRetentionDays =
      company.incident_retention_days > 0
        ? company.incident_retention_days
        : DEFAULT_INCIDENT_RETENTION_DAYS;
    const incidentCutoff = getRetentionCutoff(incidentRetentionDays, now);
    try {
      const incidentDeleted = await publicDb.incidentReport.deleteMany({
        where: {
          company_id: company.id,
          status: "CLOSED",
          legal_hold: false,
          OR: [
            { retention_expires_at: { lt: now } },
            { retention_expires_at: null, occurred_at: { lt: incidentCutoff } },
          ],
        },
      });

      if (incidentDeleted.count > 0) {
        log.info(
          {
            companyId: company.id,
            retention_days: incidentRetentionDays,
            deleted_count: incidentDeleted.count,
          },
          "Incident retention cleanup completed",
        );
      }
    } catch (err) {
      log.warn(
        {
          companyId: company.id,
          retention_days: incidentRetentionDays,
          err: String(err),
        },
        "Incident retention cleanup failed",
      );
    }

    const drillRetentionDays =
      company.emergency_drill_retention_days > 0
        ? company.emergency_drill_retention_days
        : DEFAULT_EMERGENCY_DRILL_RETENTION_DAYS;
    const drillCutoff = getRetentionCutoff(drillRetentionDays, now);
    try {
      const drillDeleted = await publicDb.emergencyDrill.deleteMany({
        where: {
          company_id: company.id,
          legal_hold: false,
          OR: [
            { retention_expires_at: { lt: now } },
            { retention_expires_at: null, conducted_at: { lt: drillCutoff } },
          ],
        },
      });

      if (drillDeleted.count > 0) {
        log.info(
          {
            companyId: company.id,
            retention_days: drillRetentionDays,
            deleted_count: drillDeleted.count,
          },
          "Emergency drill retention cleanup completed",
        );
      }
    } catch (err) {
      log.warn(
        {
          companyId: company.id,
          retention_days: drillRetentionDays,
          err: String(err),
        },
        "Emergency drill retention cleanup failed",
      );
    }
  });
}
