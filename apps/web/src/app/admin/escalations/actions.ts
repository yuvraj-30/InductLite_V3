"use server";

/**
 * Admin Sign-In Escalation Actions
 *
 * Handles approve/deny decisions for blocked red-flag sign-ins.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertOrigin, checkSitePermission } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  approveSignInEscalation,
  createPublicSignIn,
  denySignInEscalation,
  findSignInEscalationById,
  RepositoryError,
} from "@/lib/repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import {
  type ApiResponse,
  errorResponse,
  permissionDeniedResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api";

const escalationDecisionSchema = z.object({
  escalationId: z.string().cuid("Invalid escalation ID"),
  reviewNotes: z
    .string()
    .max(1000, "Review notes must be 1000 characters or less")
    .optional()
    .or(z.literal("")),
});

function parseDecisionForm(formData: FormData) {
  const parsed = escalationDecisionSchema.safeParse({
    escalationId: formData.get("escalationId"),
    reviewNotes: formData.get("reviewNotes")?.toString() ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    parsed.error.issues.forEach((error) => {
      const field = error.path.join(".") || "form";
      fieldErrors[field] = fieldErrors[field] ?? [];
      fieldErrors[field].push(error.message);
    });
    return { success: false as const, fieldErrors };
  }
  return { success: true as const, data: parsed.data };
}

function mapEscalationDecisionRepositoryError(error: RepositoryError) {
  switch (error.code) {
    case "NOT_FOUND":
      return errorResponse("NOT_FOUND", "Escalation not found");
    case "VALIDATION":
    case "INVALID_INPUT":
    case "ALREADY_EXISTS":
      return errorResponse("VALIDATION_ERROR", error.message);
    default:
      return errorResponse("INTERNAL_ERROR", "Failed to process escalation");
  }
}

export async function approveSignInEscalationAction(
  formData: FormData,
): Promise<ApiResponse<{ escalationId: string; signInRecordId: string }>> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    await assertOrigin();
  } catch {
    return errorResponse("FORBIDDEN", "Invalid request origin");
  }

  const parsed = parseDecisionForm(formData);
  if (!parsed.success) {
    return validationErrorResponse(parsed.fieldErrors, "Invalid escalation data");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const escalation = await findSignInEscalationById(
    context.companyId,
    parsed.data.escalationId,
  );
  if (!escalation) {
    return errorResponse("NOT_FOUND", "Escalation not found");
  }

  const guard = await checkSitePermission("site:manage", escalation.site_id);
  if (!guard.success) {
    return permissionDeniedResponse(guard.error);
  }

  if (escalation.status !== "PENDING") {
    return errorResponse("VALIDATION_ERROR", "Escalation has already been resolved");
  }

  if (!escalation.signature_data) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Escalation cannot be approved without a signature",
    );
  }

  try {
    const signInResult = await createPublicSignIn({
      companyId: escalation.company_id,
      siteId: escalation.site_id,
      idempotencyKey: escalation.idempotency_key,
      visitorName: escalation.visitor_name,
      visitorPhone: escalation.visitor_phone,
      visitorEmail: escalation.visitor_email ?? undefined,
      employerName: escalation.employer_name ?? undefined,
      visitorType: escalation.visitor_type,
      roleOnSite: escalation.role_on_site ?? undefined,
      hasAcceptedTerms: escalation.hasAcceptedTerms,
      templateId: escalation.template_id,
      templateVersion: escalation.template_version,
      answers: escalation.answers,
      signatureData: escalation.signature_data,
      termsVersionId: escalation.terms_version_id ?? undefined,
      privacyVersionId: escalation.privacy_version_id ?? undefined,
      consentStatement: escalation.consent_statement ?? undefined,
      competencyEvidence: {
        status: "SUPERVISOR_APPROVED",
        supervisorVerifiedBy: context.userId,
        supervisorVerifiedAt: new Date(),
        briefingAcknowledgedAt: escalation.termsAcceptedAt ?? new Date(),
      },
    });

    await approveSignInEscalation(context.companyId, escalation.id, {
      reviewedBy: context.userId,
      approvedSignInRecordId: signInResult.signInRecordId,
      reviewNotes: parsed.data.reviewNotes || undefined,
    });

    await createAuditLog(context.companyId, {
      action: "visitor.sign_in_escalation_approved",
      entity_type: "PendingSignInEscalation",
      entity_id: escalation.id,
      user_id: context.userId,
      details: {
        site_id: escalation.site_id,
        sign_in_record_id: signInResult.signInRecordId,
      },
      request_id: requestId,
    });

    revalidatePath("/admin/escalations");
    revalidatePath("/admin/live-register");
    revalidatePath("/admin/history");

    return successResponse(
      {
        escalationId: escalation.id,
        signInRecordId: signInResult.signInRecordId,
      },
      "Escalation approved and visitor signed in",
    );
  } catch (error) {
    if (error instanceof RepositoryError) {
      return mapEscalationDecisionRepositoryError(error);
    }
    log.error(
      {
        requestId,
        escalationId: escalation.id,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to approve sign-in escalation",
    );
    return errorResponse("INTERNAL_ERROR", "Failed to approve escalation");
  }
}

export async function denySignInEscalationAction(
  formData: FormData,
): Promise<ApiResponse<{ escalationId: string }>> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    await assertOrigin();
  } catch {
    return errorResponse("FORBIDDEN", "Invalid request origin");
  }

  const parsed = parseDecisionForm(formData);
  if (!parsed.success) {
    return validationErrorResponse(parsed.fieldErrors, "Invalid escalation data");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const escalation = await findSignInEscalationById(
    context.companyId,
    parsed.data.escalationId,
  );
  if (!escalation) {
    return errorResponse("NOT_FOUND", "Escalation not found");
  }

  const guard = await checkSitePermission("site:manage", escalation.site_id);
  if (!guard.success) {
    return permissionDeniedResponse(guard.error);
  }

  if (escalation.status !== "PENDING") {
    return errorResponse("VALIDATION_ERROR", "Escalation has already been resolved");
  }

  try {
    await denySignInEscalation(context.companyId, escalation.id, {
      reviewedBy: context.userId,
      reviewNotes: parsed.data.reviewNotes || undefined,
    });

    await createAuditLog(context.companyId, {
      action: "visitor.sign_in_escalation_denied",
      entity_type: "PendingSignInEscalation",
      entity_id: escalation.id,
      user_id: context.userId,
      details: {
        site_id: escalation.site_id,
      },
      request_id: requestId,
    });

    revalidatePath("/admin/escalations");
    revalidatePath("/admin/live-register");

    return successResponse(
      { escalationId: escalation.id },
      "Escalation denied",
    );
  } catch (error) {
    if (error instanceof RepositoryError) {
      return mapEscalationDecisionRepositoryError(error);
    }
    log.error(
      {
        requestId,
        escalationId: escalation.id,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to deny sign-in escalation",
    );
    return errorResponse("INTERNAL_ERROR", "Failed to deny escalation");
  }
}
