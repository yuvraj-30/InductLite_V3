"use server";

import { z } from "zod";
import { assertOrigin, checkAdmin } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { prisma } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { createExportSchema } from "@inductlite/shared";
import {
  type ApiResponse,
  successResponse,
  errorResponse,
  validationErrorResponse,
  permissionDeniedResponse,
} from "@/lib/api";
import { generateRequestId } from "@/lib/auth/csrf";
import { createRequestLogger } from "@/lib/logger";
import { revalidatePath } from "next/cache";

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

  // Tenant context
  const context = await requireAuthenticatedContextReadOnly();

  try {
    const job = await prisma.exportJob.create({
      data: {
        company_id: context.companyId,
        export_type: parsed.data.exportType,
        parameters: parsed.data,
        requested_by: context.userId,
        status: "QUEUED",
      },
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
