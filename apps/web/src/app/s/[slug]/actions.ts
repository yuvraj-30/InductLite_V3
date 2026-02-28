"use server";

/**
 * Public Sign-In/Sign-Out Server Actions
 *
 * Handles public (unauthenticated) sign-in and sign-out operations.
 * All actions include:
 * - Rate limiting
 * - Input validation with Zod
 * - AuditLog entries
 */

import {
  findSiteByPublicSlug,
  listSiteManagerNotificationRecipients,
} from "@/lib/repository/site.repository";
import { getActiveTemplateForSite } from "@/lib/repository/template.repository";
import {
  createPublicSignIn,
  signOutWithToken,
  type SignInResult,
} from "@/lib/repository/public-signin.repository";
import { queueEmailNotification } from "@/lib/repository/email.repository";
import {
  createPendingSignInEscalation,
  setSignInEscalationNotificationCounts,
} from "@/lib/repository/signin-escalation.repository";
import {
  listSiteEmergencyContacts,
  listSiteEmergencyProcedures,
} from "@/lib/repository/emergency.repository";
import {
  buildConsentStatement,
  getOrCreateActiveLegalVersions,
} from "@/lib/legal/consent-versioning";
import { createAuditLog } from "@/lib/repository/audit.repository";
import {
  checkPublicSlugRateLimit,
  checkSignInRateLimit,
  checkSignOutRateLimit,
} from "@/lib/rate-limit";
import { createRequestLogger } from "@/lib/logger";
import {
  assertOrigin,
  generateRequestId,
  getClientIp,
  getUserAgent,
} from "@/lib/auth/csrf";
import {
  type ApiResponse,
  successResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api";
import {
  signInSchema,
  signOutSchema,
  type SignInInput,
  type SignOutInput,
} from "@/lib/validation/schemas";
import { formatToE164 } from "@inductlite/shared";

// Re-export types for consumers
export type {
  SignInInput,
  SignOutInput,
  VisitorType,
} from "@/lib/validation/schemas";

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Convert unknown errors to a safe public-facing message.
 *
 * SECURITY: Never expose raw error messages to public endpoints as they may contain:
 * - Database connection strings
 * - SQL query fragments
 * - Internal file paths
 * - Stack traces with sensitive context
 *
 * The original error is logged server-side with full details.
 */
function safePublicErrorMessage(err: unknown): string {
  // Log the actual error internally for debugging
  // The caller should have already logged with context

  // Return a generic message regardless of error type
  // Known error types get slightly more specific (but still safe) messages
  if (err instanceof Error) {
    // Check for known safe error patterns that we can expose
    const message = err.message.toLowerCase();

    if (message.includes("rate limit")) {
      return "Too many requests. Please try again later.";
    }

    if (message.includes("not found")) {
      return "The requested resource was not found.";
    }

    if (message.includes("expired") || message.includes("invalid token")) {
      return "Your session has expired. Please try again.";
    }
  }

  // Default: never expose the actual error message
  return "An unexpected error occurred. Please try again.";
}

const NON_TRIGGERING_RED_FLAG_ANSWERS = new Set([
  "no",
  "false",
  "none",
  "n/a",
  "na",
  "nil",
  "0",
]);

const QUICK_START_IMPLICIT_RED_FLAG_EXPECTATIONS = new Map<string, "yes" | "no">([
  ["I know where the emergency assembly point is.", "yes"],
  ["I am wearing the required PPE for this site.", "yes"],
]);

function shouldTriggerRedFlag(answer: unknown): boolean {
  if (answer === null || answer === undefined) {
    return false;
  }

  if (typeof answer === "boolean") {
    return answer;
  }

  if (typeof answer === "number") {
    return answer !== 0;
  }

  if (Array.isArray(answer)) {
    return answer.some((value) => shouldTriggerRedFlag(value));
  }

  if (typeof answer === "string") {
    const normalized = answer.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    return !NON_TRIGGERING_RED_FLAG_ANSWERS.has(normalized);
  }

  // Fail closed for unexpected answer shapes.
  return true;
}

function normalizeYesNoValue(value: unknown): "yes" | "no" | null {
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }

  if (typeof value === "number") {
    if (value === 1) return "yes";
    if (value === 0) return "no";
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["yes", "y", "true", "1"].includes(normalized)) return "yes";
  if (["no", "n", "false", "0"].includes(normalized)) return "no";
  return null;
}

function normalizeComparableValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.trim().toLowerCase();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeComparableValue(entry));
  }

  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const sortedEntries = Object.keys(objectValue)
      .sort()
      .map((key) => [key, normalizeComparableValue(objectValue[key])]);
    return Object.fromEntries(sortedEntries);
  }

  return value;
}

function answersEquivalent(left: unknown, right: unknown): boolean {
  return (
    JSON.stringify(normalizeComparableValue(left)) ===
    JSON.stringify(normalizeComparableValue(right))
  );
}

function shouldTriggerRedFlagForQuestion(
  question: {
    question_type?: string;
    correct_answer?: unknown;
  },
  answer: unknown,
): boolean {
  if (question.correct_answer !== undefined && question.correct_answer !== null) {
    if (question.question_type === "YES_NO") {
      const expected = normalizeYesNoValue(question.correct_answer);
      const actual = normalizeYesNoValue(answer);
      if (expected !== null && actual !== null) {
        return actual !== expected;
      }
    }

    return !answersEquivalent(answer, question.correct_answer);
  }

  return shouldTriggerRedFlag(answer);
}

function findTriggeredRedFlagQuestions(
  templateQuestions: Array<{
    id: string;
    question_text: string;
    red_flag: boolean;
    question_type?: string;
    correct_answer?: unknown;
  }>,
  answers: SignInInput["answers"],
) {
  const answersByQuestionId = new Map(
    answers.map((answer) => [answer.questionId, answer.answer]),
  );

  return templateQuestions
    .filter(
      (question) =>
        question.red_flag ||
        QUICK_START_IMPLICIT_RED_FLAG_EXPECTATIONS.has(question.question_text),
    )
    .filter((question) => {
      const implicitExpectedAnswer =
        QUICK_START_IMPLICIT_RED_FLAG_EXPECTATIONS.get(question.question_text);
      const evaluationQuestion = {
        ...question,
        question_type: question.question_type ?? "YES_NO",
        correct_answer:
          question.correct_answer ?? implicitExpectedAnswer ?? undefined,
      };

      return shouldTriggerRedFlagForQuestion(
        evaluationQuestion,
        answersByQuestionId.get(question.id),
      );
    });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildEscalationEmailBody(input: {
  siteName: string;
  visitorType: string;
  redFlagQuestions: string[];
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  const escalationsLink = appUrl
    ? `${appUrl}/admin/escalations`
    : "/admin/escalations";

  return `
    <h1>Supervisor Escalation Required</h1>
    <p>A public induction has been blocked after a critical red-flag response.</p>
    <p><strong>Site:</strong> ${escapeHtml(input.siteName)}</p>
    <p><strong>Visitor Type:</strong> ${escapeHtml(input.visitorType)}</p>
    <p><strong>Triggered Questions:</strong></p>
    <ul>
      ${input.redFlagQuestions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}
    </ul>
    <p>Review and follow up before site entry is permitted.</p>
    <p><a href="${escalationsLink}">Review Escalations</a></p>
  `;
}

// ============================================================================
// TYPES
// ============================================================================

export interface SiteInfo {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  companyId: string;
  companyName: string;
  emergencyContacts?: Array<{
    id: string;
    name: string;
    role: string | null;
    phone: string;
    notes: string | null;
  }>;
  emergencyProcedures?: Array<{
    id: string;
    title: string;
    instructions: string;
  }>;
  legal?: {
    termsVersion: number;
    privacyVersion: number;
    consentStatement: string;
  };
}

export interface TemplateInfo {
  id: string;
  name: string;
  version: number;
  questions: Array<{
    id: string;
    questionText: string;
    questionType: string;
    options: string[] | null;
    isRequired: boolean;
    redFlag: boolean;
    displayOrder: number;
  }>;
}

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Get site info and active template for a public slug
 */
export async function getSiteForSignIn(
  slug: string,
  options?: { skipRateLimit?: boolean },
): Promise<
  ApiResponse<{ site: SiteInfo; template: TemplateInfo } | { notFound: true }>
> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  // Rate limit check (can be skipped by callers that only need metadata)
  if (!options?.skipRateLimit) {
    const rateLimit = await checkPublicSlugRateLimit(slug);
    if (!rateLimit.success) {
      log.warn({ slug }, "Rate limit exceeded for public slug");
      return errorResponse(
        "RATE_LIMITED",
        "Too many requests. Please try again later.",
      );
    }
  }

  try {
    // Find site by slug
    const site = await findSiteByPublicSlug(slug);
    if (!site) {
      return successResponse({ notFound: true as const });
    }

    // Get active template for the site
    const template = await getActiveTemplateForSite(site.company.id, site.id);
    if (!template) {
      log.warn({ siteId: site.id }, "No active template for site");
      return errorResponse(
        "NO_TEMPLATE",
        "This site does not have an active induction template. Please contact site management.",
      );
    }

    const [emergencyContacts, emergencyProcedures, legalVersions] =
      await Promise.all([
        listSiteEmergencyContacts(site.company.id, site.id),
        listSiteEmergencyProcedures(site.company.id, site.id),
        getOrCreateActiveLegalVersions(site.company.id),
      ]);

    const consentStatement = buildConsentStatement({
      siteName: site.name,
      includeEmergencyReminder: true,
    });

    return successResponse({
      site: {
        id: site.id,
        name: site.name,
        address: site.address,
        description: site.description,
        companyId: site.company.id,
        companyName: site.company.name,
        emergencyContacts: emergencyContacts.map((contact) => ({
          id: contact.id,
          name: contact.name,
          role: contact.role,
          phone: contact.phone,
          notes: contact.notes,
        })),
        emergencyProcedures: emergencyProcedures.map((procedure) => ({
          id: procedure.id,
          title: procedure.title,
          instructions: procedure.instructions,
        })),
        legal: {
          termsVersion: legalVersions.terms.version,
          privacyVersion: legalVersions.privacy.version,
          consentStatement,
        },
      },
      template: {
        id: template.id,
        name: template.name,
        version: template.version,
        questions: template.questions.map((q) => ({
          id: q.id,
          questionText: q.question_text,
          questionType: q.question_type,
          options: q.options as string[] | null,
          isRequired: q.is_required,
          redFlag: q.red_flag,
          displayOrder: q.display_order,
        })),
      },
    });
  } catch (error) {
    log.error(
      {
        requestId,
        slug,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to get site for sign-in",
    );
    return errorResponse("INTERNAL_ERROR", safePublicErrorMessage(error));
  }
}

/**
 * Submit a public sign-in with induction completion
 * Note: Public form - no auth context. Uses rate limiting for protection.
 */

export async function submitSignIn(
  input: SignInInput,
): Promise<ApiResponse<SignInResult>> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    await assertOrigin();
  } catch {
    return errorResponse("FORBIDDEN", "Invalid request origin");
  }

  // Validate input
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    parsed.error.errors.forEach((e) => {
      const field = e.path.join(".");
      fieldErrors[field] = fieldErrors[field] || [];
      fieldErrors[field].push(e.message);
    });
    return validationErrorResponse(fieldErrors, "Invalid sign-in data");
  }

  // Rate limit check
  const rateLimit = await checkSignInRateLimit(parsed.data.slug);
  if (!rateLimit.success) {
    log.warn({ slug: parsed.data.slug }, "Sign-in rate limit exceeded");
    return errorResponse(
      "RATE_LIMITED",
      "Too many sign-in attempts. Please try again later.",
    );
  }

  const idempotencyKey = parsed.data.idempotencyKey ?? `legacy-${requestId}`;

  try {
    // Get site and template
    const site = await findSiteByPublicSlug(parsed.data.slug);
    if (!site) {
      return errorResponse("NOT_FOUND", "Site not found");
    }

    const template = await getActiveTemplateForSite(site.company.id, site.id);
    if (!template) {
      return errorResponse("NO_TEMPLATE", "No active induction template");
    }

    const legalVersions = await getOrCreateActiveLegalVersions(site.company.id);
    const consentStatement = buildConsentStatement({
      siteName: site.name,
      includeEmergencyReminder: true,
    });

    // Validate required answers
    const requiredQuestionIds = new Set(
      template.questions.filter((q) => q.is_required).map((q) => q.id),
    );
    const answeredIds = new Set(parsed.data.answers.map((a) => a.questionId));

    for (const requiredId of requiredQuestionIds) {
      if (!answeredIds.has(requiredId)) {
        const question = template.questions.find((q) => q.id === requiredId);
        return validationErrorResponse(
          { answers: [`Answer required for: ${question?.question_text}`] },
          "Please complete all required questions",
        );
      }
    }

    // Validate answer values for required questions
    for (const answer of parsed.data.answers) {
      const question = template.questions.find(
        (q) => q.id === answer.questionId,
      );
      if (!question) continue;

      if (question.is_required) {
        if (
          answer.answer === null ||
          answer.answer === undefined ||
          answer.answer === "" ||
          (Array.isArray(answer.answer) && answer.answer.length === 0)
        ) {
          return validationErrorResponse(
            { answers: [`Answer required for: ${question.question_text}`] },
            "Please complete all required questions",
          );
        }

        // For ACKNOWLEDGMENT, must be true
        if (
          question.question_type === "ACKNOWLEDGMENT" &&
          answer.answer !== true
        ) {
          return validationErrorResponse(
            { answers: [`You must acknowledge: ${question.question_text}`] },
            "Please acknowledge all required statements",
          );
        }
      }
    }

    // Format phone to E.164 for consistent storage and verification
    const formattedPhone = formatToE164(parsed.data.visitorPhone, "NZ");
    if (!formattedPhone) {
      return validationErrorResponse(
        { visitorPhone: ["Invalid phone number"] },
        "Invalid sign-in data",
      );
    }

    if (!parsed.data.signatureData?.trim()) {
      return validationErrorResponse(
        { signatureData: ["Signature is required"] },
        "Please provide your signature before signing in",
      );
    }

    const triggeredRedFlagQuestions = findTriggeredRedFlagQuestions(
      template.questions,
      parsed.data.answers,
    );
    if (triggeredRedFlagQuestions.length > 0) {
      const [ip, userAgent] = await Promise.all([getClientIp(), getUserAgent()]);
      const redFlagQuestionIds = triggeredRedFlagQuestions.map((q) => q.id);
      const redFlagQuestionTexts = triggeredRedFlagQuestions.map(
        (q) => q.question_text,
      );

      const escalationCreated = await createPendingSignInEscalation({
        companyId: site.company.id,
        siteId: site.id,
        idempotencyKey,
        visitorName: parsed.data.visitorName,
        visitorPhone: formattedPhone,
        visitorEmail: parsed.data.visitorEmail || undefined,
        employerName: parsed.data.employerName || undefined,
        visitorType: parsed.data.visitorType,
        roleOnSite: parsed.data.roleOnSite || undefined,
        hasAcceptedTerms: parsed.data.hasAcceptedTerms,
        termsAcceptedAt: new Date(),
        termsVersionId: legalVersions.terms.id,
        privacyVersionId: legalVersions.privacy.id,
        consentStatement,
        templateId: template.id,
        templateVersion: template.version,
        answers: parsed.data.answers,
        signatureData: parsed.data.signatureData.trim(),
        redFlagQuestionIds,
        redFlagQuestions: redFlagQuestionTexts,
      });
    if (
      !escalationCreated.created &&
      escalationCreated.escalation.status === "APPROVED"
    ) {
      if (
        !escalationCreated.escalation.reviewed_by ||
        !escalationCreated.escalation.reviewed_at
      ) {
        log.error(
          {
            requestId,
            siteId: site.id,
            escalationId: escalationCreated.escalation.id,
          },
          "Approved escalation is missing supervisor reviewer metadata",
        );
        return errorResponse(
          "INTERNAL_ERROR",
          "Escalation approval evidence is incomplete. Please contact reception.",
        );
      }

      const approvedResult = await createPublicSignIn({
        companyId: site.company.id,
        siteId: site.id,
        idempotencyKey,
        visitorName: parsed.data.visitorName,
          visitorPhone: formattedPhone,
          visitorEmail: parsed.data.visitorEmail || undefined,
          employerName: parsed.data.employerName,
          visitorType: parsed.data.visitorType,
          roleOnSite: parsed.data.roleOnSite,
          hasAcceptedTerms: parsed.data.hasAcceptedTerms,
          templateId: template.id,
          templateVersion: template.version,
          answers: parsed.data.answers,
        signatureData: parsed.data.signatureData,
        termsVersionId: legalVersions.terms.id,
        privacyVersionId: legalVersions.privacy.id,
        consentStatement,
        competencyEvidence: {
          status: "SUPERVISOR_APPROVED",
          supervisorVerifiedBy: escalationCreated.escalation.reviewed_by,
          supervisorVerifiedAt: escalationCreated.escalation.reviewed_at,
          briefingAcknowledgedAt:
            escalationCreated.escalation.termsAcceptedAt ?? new Date(),
        },
      });

        await createAuditLog(site.company.id, {
          action: "visitor.sign_in",
          entity_type: "SignInRecord",
          entity_id: approvedResult.signInRecordId,
          user_id: undefined,
          details: {
            site_id: site.id,
            site_name: site.name,
            visitor_name: parsed.data.visitorName,
            visitor_type: parsed.data.visitorType,
            template_id: template.id,
            template_version: template.version,
            escalation_id: escalationCreated.escalation.id,
          },
          ip_address: ip,
          user_agent: userAgent,
          request_id: requestId,
        });

        return successResponse(approvedResult, "Signed in successfully");
      }

      if (
        !escalationCreated.created &&
        escalationCreated.escalation.status === "DENIED"
      ) {
        return validationErrorResponse(
          {
            answers: [
              "Site entry was denied by a supervisor. Please contact reception for next steps.",
            ],
          },
          "Supervisor denied site entry",
        );
      }

      let managerNotificationTargets = 0;
      let managerNotificationsQueued = 0;

      if (escalationCreated.created) {
        try {
          const recipients = await listSiteManagerNotificationRecipients(
            site.company.id,
            site.id,
          );
          managerNotificationTargets = recipients.length;

          if (recipients.length > 0) {
            const queueResults = await Promise.allSettled(
              recipients.map((recipient) =>
                queueEmailNotification(site.company.id, {
                  user_id: recipient.userId,
                  to: recipient.email,
                  subject: `Escalation Required: Blocked induction at ${site.name}`,
                  body: buildEscalationEmailBody({
                    siteName: site.name,
                    visitorType: parsed.data.visitorType,
                    redFlagQuestions: redFlagQuestionTexts,
                  }),
                }),
              ),
            );
            managerNotificationsQueued = queueResults.filter(
              (result) => result.status === "fulfilled",
            ).length;

            const queueFailures = queueResults.length - managerNotificationsQueued;
            if (queueFailures > 0) {
              log.error(
                {
                  requestId,
                  siteId: site.id,
                  escalationId: escalationCreated.escalation.id,
                  queueFailures,
                  queueTargets: queueResults.length,
                },
                "Failed to queue one or more escalation notifications",
              );
            }
          }

          await setSignInEscalationNotificationCounts(
            site.company.id,
            escalationCreated.escalation.id,
            managerNotificationTargets,
            managerNotificationsQueued,
          );
        } catch (notificationError) {
          log.error(
            {
              requestId,
              siteId: site.id,
              escalationId: escalationCreated.escalation.id,
              notificationErrorType:
                notificationError instanceof Error
                  ? notificationError.name
                  : "unknown",
            },
            "Failed to resolve or queue escalation notifications",
          );
        }
      } else {
        managerNotificationTargets =
          escalationCreated.escalation.notification_targets;
        managerNotificationsQueued =
          escalationCreated.escalation.notifications_queued;
      }

      try {
        await createAuditLog(site.company.id, {
          action: "visitor.sign_in_escalation_submitted",
          entity_type: "PendingSignInEscalation",
          entity_id: escalationCreated.escalation.id,
          user_id: undefined,
          details: {
            reason: "critical_red_flag_response",
            site_id: site.id,
            site_name: site.name,
            visitor_type: parsed.data.visitorType,
            template_id: template.id,
            template_version: template.version,
            red_flag_question_ids: redFlagQuestionIds,
            red_flag_questions: redFlagQuestionTexts,
            manager_notification_targets: managerNotificationTargets,
            manager_notifications_queued: managerNotificationsQueued,
            escalation_status: escalationCreated.escalation.status,
          },
          ip_address: ip,
          user_agent: userAgent,
          request_id: requestId,
        });
      } catch (auditError) {
        log.error(
          {
            requestId,
            siteId: site.id,
            escalationId: escalationCreated.escalation.id,
            auditErrorType:
              auditError instanceof Error ? auditError.name : "unknown",
          },
          "Failed to persist red-flag escalation audit event",
        );
      }

      log.warn(
        {
          siteId: site.id,
          escalationId: escalationCreated.escalation.id,
          redFlagQuestionIds,
        },
        "Visitor sign-in blocked pending supervisor escalation",
      );

      return validationErrorResponse(
        {
          answers: [
            `Critical safety response detected. Supervisor review required (ref ${escalationCreated.escalation.id.slice(0, 8)}).`,
          ],
        },
        "Supervisor approval required before sign-in",
      );
    }

    // Create sign-in record
    const result = await createPublicSignIn({
      companyId: site.company.id,
      siteId: site.id,
      idempotencyKey,
      visitorName: parsed.data.visitorName,
      visitorPhone: formattedPhone,
      visitorEmail: parsed.data.visitorEmail || undefined,
      employerName: parsed.data.employerName,
      visitorType: parsed.data.visitorType,
      roleOnSite: parsed.data.roleOnSite,
      hasAcceptedTerms: parsed.data.hasAcceptedTerms,
      templateId: template.id,
      templateVersion: template.version,
      answers: parsed.data.answers,
      signatureData: parsed.data.signatureData,
      termsVersionId: legalVersions.terms.id,
      privacyVersionId: legalVersions.privacy.id,
      consentStatement,
      competencyEvidence: {
        status: "SELF_DECLARED",
        briefingAcknowledgedAt: new Date(),
      },
    });

    // Create audit log
    const [ip, userAgent] = await Promise.all([getClientIp(), getUserAgent()]);
    await createAuditLog(site.company.id, {
      action: "visitor.sign_in",
      entity_type: "SignInRecord",
      entity_id: result.signInRecordId,
      user_id: undefined, // Public action
      details: {
        site_id: site.id,
        site_name: site.name,
        visitor_name: parsed.data.visitorName,
        visitor_type: parsed.data.visitorType,
        template_id: template.id,
        template_version: template.version,
      },
      ip_address: ip,
      user_agent: userAgent,
      request_id: requestId,
    });

    log.info(
      {
        signInRecordId: result.signInRecordId,
        siteId: site.id,
        visitorType: parsed.data.visitorType,
      },
      "Visitor signed in",
    );

    // Trigger webhooks (non-blocking)
    const siteWithWebhooks = site as unknown as { webhooks?: unknown };
    if (siteWithWebhooks.webhooks && Array.isArray(siteWithWebhooks.webhooks)) {
      const webhooks = siteWithWebhooks.webhooks as string[];
      webhooks.forEach((url) => {
        // Use a detached promise to avoid blocking the response
        Promise.resolve().then(async () => {
          try {
            await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: "induction.completed",
                timestamp: new Date().toISOString(),
                data: result,
              }),
            });
          } catch (err) {
            log.error({ url, err: String(err) }, "Webhook delivery failed");
          }
        });
      });
    }

    return successResponse(result, "Signed in successfully");
  } catch (error) {
    log.error(
      {
        requestId,
        slug: parsed.data.slug,
        errorType: error instanceof Error ? error.name : "unknown",
        // Never log: visitorName, visitorPhone, visitorEmail
      },
      "Failed to create sign-in",
    );
    return errorResponse("INTERNAL_ERROR", safePublicErrorMessage(error));
  }
}

/**
 * Sign out using a token (self-service)
 * Note: Uses signed token for authentication instead of CSRF.
 */

export async function submitSignOut(
  input: SignOutInput,
): Promise<ApiResponse<{ visitorName: string }>> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    await assertOrigin();
  } catch {
    return errorResponse("FORBIDDEN", "Invalid request origin");
  }

  // Validate input
  const parsed = signOutSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    parsed.error.errors.forEach((e) => {
      const field = e.path.join(".");
      fieldErrors[field] = fieldErrors[field] || [];
      fieldErrors[field].push(e.message);
    });
    return validationErrorResponse(fieldErrors, "Invalid sign-out data");
  }

  // Rate limit check (use first 10 chars of token as identifier)
  const tokenPrefix = parsed.data.token.substring(0, 10);
  const rateLimit = await checkSignOutRateLimit(tokenPrefix);
  if (!rateLimit.success) {
    log.warn({}, "Sign-out rate limit exceeded");
    return errorResponse(
      "RATE_LIMITED",
      "Too many sign-out attempts. Please try again later.",
    );
  }

  try {
    const result = await signOutWithToken(parsed.data.token, parsed.data.phone);

    if (!result.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        result.error || "Sign-out failed",
      );
    }

    // Create audit log for sign-out
    const [ip, userAgent] = await Promise.all([getClientIp(), getUserAgent()]);
    await createAuditLog(result.companyId!, {
      action: "visitor.sign_out",
      entity_type: "SignInRecord",
      entity_id: result.signInRecordId!,
      user_id: undefined, // Self sign-out via token
      details: {
        site_id: result.siteId,
        site_name: result.siteName,
        visitor_name: result.visitorName,
        sign_out_method: "token",
      },
      ip_address: ip,
      user_agent: userAgent,
      request_id: requestId,
    });

    log.info(
      {
        signInRecordId: result.signInRecordId,
        visitorName: result.visitorName,
      },
      "Visitor signed out via token",
    );

    return successResponse(
      { visitorName: result.visitorName! },
      "Signed out successfully",
    );
  } catch (error) {
    log.error(
      {
        requestId,
        errorType: error instanceof Error ? error.name : "unknown",
        // Never log: token, phone
      },
      "Failed to sign out",
    );
    return errorResponse("INTERNAL_ERROR", safePublicErrorMessage(error));
  }
}
