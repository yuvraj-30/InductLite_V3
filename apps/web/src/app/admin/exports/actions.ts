"use server";

import { z } from "zod";
import { assertOrigin, checkAdmin } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { createAuditLog } from "@/lib/repository/audit.repository";
import {
  queueExportJobWithLimits,
  ExportLimitReachedError,
  ExportGlobalBytesLimitReachedError,
  ExportQueueAgeLimitReachedError,
  getExportOffPeakDecision,
} from "@/lib/repository/export.repository";
import {
  type ApiResponse,
  successResponse,
  errorResponse,
  validationErrorResponse,
  permissionDeniedResponse,
  guardrailDeniedResponse,
} from "@/lib/api";
import { generateRequestId } from "@/lib/auth/csrf";
import { createRequestLogger } from "@/lib/logger";
import { createExportSchema } from "@/lib/validation/schemas";
import { revalidatePath } from "next/cache";
import { GUARDRAILS, isOffPeakNow } from "@/lib/guardrails";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import {
  enforceBudgetPath,
  startBudgetTrackedOperation,
} from "@/lib/cost/budget-service";

export async function createExportAction(
  input: z.infer<typeof createExportSchema>,
): Promise<ApiResponse<{ exportJobId: string }>> {
  const finishBudgetTracking = startBudgetTrackedOperation("server_action");
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    // CSRF protection for server actions
    try {
      await assertOrigin();
    } catch {
      return errorResponse("FORBIDDEN", "Invalid request origin");
    }

    // Validate payload
    const parsed = createExportSchema.safeParse(input);
    if (!parsed.success) {
      return validationErrorResponse(
        { export: parsed.error.issues.map((e) => e.message) },
        "Invalid export parameters",
      );
    }

    // Admin check
    const guard = await checkAdmin();
    if (!guard.success) return permissionDeniedResponse(guard.error);

    if (!isFeatureEnabled("EXPORTS")) {
      return errorResponse("FORBIDDEN", "Exports are currently disabled");
    }

    // Tenant context
    const context = await requireAuthenticatedContextReadOnly();
    const budgetDecision = await enforceBudgetPath("admin.export.create");
    if (!budgetDecision.allowed) {
      return guardrailDeniedResponse(
        budgetDecision.controlId ?? "COST-008",
        budgetDecision.violatedLimit ?? `ENV_BUDGET_TIER=${budgetDecision.state.budgetTier}`,
        budgetDecision.scope,
        budgetDecision.message,
      );
    }

    const requiresAdvancedExport =
      parsed.data.exportType === "SITE_PACK_PDF" ||
      parsed.data.exportType === "COMPLIANCE_ZIP";
    if (requiresAdvancedExport) {
      try {
        await assertCompanyFeatureEnabled(context.companyId, "EXPORTS_ADVANCED");
      } catch (error) {
        if (error instanceof EntitlementDeniedError) {
          return errorResponse(
            "FORBIDDEN",
            "Advanced export bundles are disabled for your current plan",
          );
        }

        log.error(
          {
            requestId,
            companyId: context.companyId,
            exportType: parsed.data.exportType,
            errorType: error instanceof Error ? error.name : "unknown",
          },
          "Failed to evaluate export entitlements",
        );
        return errorResponse("INTERNAL_ERROR", "Failed to queue export job");
      }
    }

    const offPeakDecision = await getExportOffPeakDecision();
    if (offPeakDecision.active && !isOffPeakNow()) {
      return guardrailDeniedResponse(
        offPeakDecision.reason === "auto" ? "EXPT-005" : "EXPT-013",
        offPeakDecision.reason === "auto"
          ? `EXPORT_OFFPEAK_AUTO_ENABLE_THRESHOLD_PERCENT=${offPeakDecision.thresholdPercent}|EXPORT_OFFPEAK_AUTO_ENABLE_QUEUE_DELAY_SECONDS=${offPeakDecision.queueDelaySeconds}|EXPORT_OFFPEAK_AUTO_ENABLE_DAYS=${offPeakDecision.windowDays}`
          : `EXPORT_OFFPEAK_ONLY=${GUARDRAILS.EXPORT_OFFPEAK_ONLY}`,
        "environment",
        offPeakDecision.reason === "auto"
          ? "Exports are temporarily restricted to off-peak hours while queue pressure is high"
          : "Exports are only available during off-peak hours",
      );
    }

    const job = await queueExportJobWithLimits(context.companyId, {
      export_type: parsed.data.exportType,
      parameters: parsed.data,
      requested_by: context.userId,
    });

    await createAuditLog(context.companyId, {
      action: "export.create",
      entity_type: "ExportJob",
      entity_id: job.id,
      user_id: context.userId,
      details: { parameters: parsed.data },
      request_id: requestId,
    });

    // Revalidate the admin exports page so the UI reflects the newly queued job
    try {
      revalidatePath("/admin/exports");
    } catch (err) {
      log.warn({ err: String(err) }, "Failed to revalidate /admin/exports");
    }

    log.info({ exportJobId: job.id }, "Export job queued");

    return successResponse({ exportJobId: job.id }, "Export queued");
  } catch (error) {
    if (error instanceof ExportGlobalBytesLimitReachedError) {
      return guardrailDeniedResponse(
        "EXPT-002",
        `MAX_EXPORT_BYTES_GLOBAL_PER_DAY=${GUARDRAILS.MAX_EXPORT_BYTES_GLOBAL_PER_DAY}`,
        "environment",
        "Global export generation budget reached. Please try again tomorrow.",
      );
    }
    if (error instanceof ExportLimitReachedError) {
      return guardrailDeniedResponse(
        "EXPT-008",
        `MAX_EXPORTS_PER_COMPANY_PER_DAY=${GUARDRAILS.MAX_EXPORTS_PER_COMPANY_PER_DAY}|MAX_CONCURRENT_EXPORTS_PER_COMPANY=${GUARDRAILS.MAX_CONCURRENT_EXPORTS_PER_COMPANY}`,
        "tenant",
        "Export limits reached for your company. Please try later.",
      );
    }
    if (error instanceof ExportQueueAgeLimitReachedError) {
      return guardrailDeniedResponse(
        "EXPT-014",
        `MAX_EXPORT_QUEUE_AGE_MINUTES=${GUARDRAILS.MAX_EXPORT_QUEUE_AGE_MINUTES}`,
        "environment",
        `Export queue pressure is too high right now. Oldest queued export age is ${Math.ceil(error.oldestQueuedAgeMinutes)} minute(s). Please retry later.`,
      );
    }
    log.error({ error: String(error) }, "Failed to queue export job");
    return errorResponse("INTERNAL_ERROR", "Failed to queue export job");
  } finally {
    finishBudgetTracking();
  }
}

// Accept FormData from a Client form and forward to typed action
export async function createExportActionFromForm(formData: FormData) {
  const exportType = String(formData.get("exportType") ?? "SIGN_IN_CSV");
  // Use schema parsing so we pass a correctly typed input without 'any'
  const input = createExportSchema.parse({ exportType });
  // Server actions used as form handlers should not return structured API responses to the client
  await createExportAction(input);
}
