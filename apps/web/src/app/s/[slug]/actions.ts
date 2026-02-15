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

import { findSiteByPublicSlug } from "@/lib/repository/site.repository";
import { getActiveTemplateForSite } from "@/lib/repository/template.repository";
import {
  createPublicSignIn,
  signOutWithToken,
  type SignInResult,
} from "@/lib/repository/public-signin.repository";
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

    return successResponse({
      site: {
        id: site.id,
        name: site.name,
        address: site.address,
        description: site.description,
        companyId: site.company.id,
        companyName: site.company.name,
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

    // Create sign-in record
    const result = await createPublicSignIn({
      companyId: site.company.id,
      siteId: site.id,
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
