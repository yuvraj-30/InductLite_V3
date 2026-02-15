"use server";

import { z } from "zod";
import { assertOrigin, checkAdmin } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { publicDb } from "@/lib/db/public-db";
import { scopedDb } from "@/lib/db/scoped-db";
import { Prisma } from "@prisma/client";
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

class ExportLimitReachedError extends Error {
  constructor() {
    super("Export limits reached");
    this.name = "ExportLimitReachedError";
  }
}

const MAX_SERIALIZABLE_RETRIES = 3;

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

  if (GUARDRAILS.EXPORT_OFFPEAK_ONLY && !isOffPeakNow()) {
    return errorResponse(
      "FORBIDDEN",
      "Exports are only available during off-peak hours",
    );
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let job: { id: string } | null = null;

    for (let attempt = 1; attempt <= MAX_SERIALIZABLE_RETRIES; attempt++) {
      try {
        job = await publicDb.$transaction(
          async (tx) => {
            const db = scopedDb(context.companyId, tx);
            const [exportsToday, runningNow] = await Promise.all([
              db.exportJob.count({
                where: {
                  company_id: context.companyId,
                  queued_at: { gte: since },
                },
              }),
              db.exportJob.count({
                where: {
                  company_id: context.companyId,
                  status: "RUNNING",
                },
              }),
            ]);

            if (
              exportsToday >= GUARDRAILS.MAX_EXPORTS_PER_COMPANY_PER_DAY ||
              runningNow >= GUARDRAILS.MAX_CONCURRENT_EXPORTS_PER_COMPANY
            ) {
              throw new ExportLimitReachedError();
            }

            return db.exportJob.create({
              data: {
                export_type: parsed.data.exportType,
                parameters: parsed.data,
                requested_by: context.userId,
                status: "QUEUED",
              },
              select: { id: true },
            });
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
        break;
      } catch (error) {
        const isSerializationConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034";
        if (isSerializationConflict && attempt < MAX_SERIALIZABLE_RETRIES) {
          continue;
        }
        throw error;
      }
    }

    if (!job) {
      throw new Error("Failed to queue export job");
    }

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
