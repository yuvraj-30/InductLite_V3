import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import {
  generateSignInCsvForCompany,
  generateContractorCsvForCompany,
} from "./worker";
import { writeExportFile } from "@/lib/storage";
import {
  claimNextQueuedExportJob,
  countRunningExportJobs,
  markExportJobFailed,
  markExportJobSucceeded,
  requeueExportJob,
  requeueStaleExportJobs,
} from "@/lib/repository/export.repository";
import { findUserById } from "@/lib/repository/user.repository";
import { createSystemAuditLog } from "@/lib/repository/audit.repository";
import {
  GUARDRAILS,
  getExportExpiryDate,
  isOffPeakNow,
} from "@/lib/guardrails";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { hasPermission } from "@/lib/auth/guards";

export async function processNextExportJob(): Promise<null | {
  id: string;
  status: string;
}> {
  if (!isFeatureEnabled("EXPORTS")) return null;

  const log = createRequestLogger(generateRequestId());

  try {
    await requeueStaleExportJobs();
  } catch (err) {
    log.warn({ err: String(err) }, "Failed to requeue stale export jobs");
  }

  const job = await claimNextQueuedExportJob();
  if (!job) return null;

  const attempts =
    ("attempts" in job ? (job as { attempts?: number }).attempts : undefined) ??
    0;
  const nextAttempt = attempts + 1;

  // Re-validate permission/ownership before processing
  if (!job.requested_by) {
    await createSystemAuditLog({
      company_id: job.company_id,
      action: "export.denied",
      entity_type: "exportJob",
      entity_id: job.id,
      details: { reason: "missing_requested_by" },
    });
    await markExportJobFailed(
      job.company_id,
      job.id,
      "Export request missing requested_by",
    );
    return { id: job.id, status: "FAILED" };
  }

  const requestingUser = await findUserById(job.company_id, job.requested_by);
  if (!requestingUser || !requestingUser.is_active) {
    await createSystemAuditLog({
      company_id: job.company_id,
      action: "export.denied",
      entity_type: "exportJob",
      entity_id: job.id,
      user_id: job.requested_by,
      details: { reason: "user_missing_or_inactive" },
    });
    await markExportJobFailed(
      job.company_id,
      job.id,
      "Export denied: user missing or inactive",
    );
    return { id: job.id, status: "FAILED" };
  }

  if (!hasPermission(requestingUser.role, "export:create")) {
    await createSystemAuditLog({
      company_id: job.company_id,
      action: "export.denied",
      entity_type: "exportJob",
      entity_id: job.id,
      user_id: job.requested_by,
      details: { reason: "permission_denied" },
    });
    await markExportJobFailed(
      job.company_id,
      job.id,
      "Export denied: insufficient permissions",
    );
    return { id: job.id, status: "FAILED" };
  }

  // Enforce per-company concurrency guardrail
  const companyRunning = await countRunningExportJobs(job.company_id);
  if (companyRunning > GUARDRAILS.MAX_CONCURRENT_EXPORTS_PER_COMPANY) {
    await requeueExportJob(job.company_id, job.id, 30_000);
    return null;
  }

  if (GUARDRAILS.EXPORT_OFFPEAK_ONLY && !isOffPeakNow()) {
    await requeueExportJob(job.company_id, job.id, 60 * 60 * 1000);
    return null;
  }

  try {
    const startTime = Date.now();
    let content = "";
    const filename = `${job.id}.csv`;

    // Special-case CONTRACTOR_CSV (P1): handle via runtime check so we can add the ExportType enum in a later migration
    if (String(job.export_type) === "CONTRACTOR_CSV") {
      content = await generateContractorCsvForCompany(job.company_id);
    } else {
      switch (job.export_type) {
        case "SIGN_IN_CSV":
          content = await generateSignInCsvForCompany(job.company_id);
          break;
        case "INDUCTION_CSV":
          // Placeholder for other export types
          content = "";
          break;
        default:
          throw new Error(`Unsupported export type: ${job.export_type}`);
      }
    }

    const { filePath, size } = await writeExportFile(
      job.company_id,
      filename,
      content,
    );

    const elapsedMs = Date.now() - startTime;
    if (elapsedMs > GUARDRAILS.MAX_EXPORT_RUNTIME_SECONDS * 1000) {
      throw new Error("Export exceeded MAX_EXPORT_RUNTIME_SECONDS guardrail");
    }

    await markExportJobSucceeded(job.company_id, job.id, {
      file_path: filePath,
      file_name: filename,
      file_size: size,
      expires_at: getExportExpiryDate(),
    });

    return { id: job.id, status: "SUCCEEDED" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (nextAttempt >= GUARDRAILS.MAX_EXPORT_ATTEMPTS) {
      await markExportJobFailed(job.company_id, job.id, message);
      return { id: job.id, status: "FAILED" };
    }

    const backoffMs = Math.min(300_000, 2 ** nextAttempt * 1000);
    await requeueExportJob(job.company_id, job.id, backoffMs);
    return { id: job.id, status: "FAILED" };
  }
}
