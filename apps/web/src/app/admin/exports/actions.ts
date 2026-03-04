"use server";

import { z } from "zod";
import { assertOrigin, checkAdmin } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { createAuditLog } from "@/lib/repository/audit.repository";
import {
  queueExportJobWithLimits,
  ExportLimitReachedError,
  ExportGlobalBytesLimitReachedError,
} from "@/lib/repository/export.repository";
import { createExportSchema } from "@inductlite/shared";
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
import { revalidatePath } from "next/cache";
import { GUARDRAILS, isOffPeakNow } from "@/lib/guardrails";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";

export async function createExportAction(
  input: z.infer<typeof createExportSchema>,
): Promise<ApiResponse<{ exportJobId: string }>> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

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
      { export: parsed.error.errors.map((e) => e.message) },
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

  if (GUARDRAILS.EXPORT_OFFPEAK_ONLY && !isOffPeakNow()) {
    return errorResponse(
      "FORBIDDEN",
      "Exports are only available during off-peak hours",
    );
  }

  try {
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
    log.error({ error: String(error) }, "Failed to queue export job");
    return errorResponse("INTERNAL_ERROR", "Failed to queue export job");
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
