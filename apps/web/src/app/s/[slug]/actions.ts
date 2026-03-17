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
import { findContractorByEmail } from "@/lib/repository/contractor.repository";
import { getActiveTemplateForSite } from "@/lib/repository/template.repository";
import {
  createPublicSignIn,
  signOutWithToken,
  type PublicSignInInput,
  type SignInResult,
} from "@/lib/repository/public-signin.repository";
import { findSignInById } from "@/lib/repository/signin.repository";
import { queueEmailNotification } from "@/lib/repository/email.repository";
import {
  createChannelDelivery,
  createCommunicationEvent,
  filterChannelIntegrationConfigsForEvent,
  listChannelIntegrationConfigs,
  markChannelDeliveryStatus,
} from "@/lib/repository/communication.repository";
import {
  createPendingSignInEscalation,
  setSignInEscalationNotificationCounts,
} from "@/lib/repository/signin-escalation.repository";
import {
  findActivePreRegistrationInviteByToken,
  markPreRegistrationInviteUsed,
} from "@/lib/repository/pre-registration.repository";
import {
  findInductionQuizAttemptState,
  upsertInductionQuizAttemptState,
} from "@/lib/repository/induction-quiz-attempt.repository";
import { queueOutboundWebhookDeliveries } from "@/lib/repository/webhook-delivery.repository";
import {
  listSiteEmergencyContacts,
  listSiteEmergencyProcedures,
} from "@/lib/repository/emergency.repository";
import { findContractorRiskScore } from "@/lib/repository/risk-passport.repository";
import {
  evaluateCompetencyForWorker,
  recordCompetencyDecision,
  type CompetencyEvaluation,
} from "@/lib/repository/competency.repository";
import {
  findRequiredPermitTemplateForSite,
  findActivePermitForVisitor,
} from "@/lib/repository/permit.repository";
import {
  createVisitorApprovalRequest,
  findActiveVisitorApprovalPolicy,
  findLatestVisitorApprovalDecision,
  matchVisitorAgainstWatchlist,
  shouldTriggerRandomCheck,
} from "@/lib/repository/visitor-approval.repository";
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
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { evaluateQuizScore } from "@/lib/quiz/scoring";
import {
  hasInductionMedia,
  parseInductionMediaConfig,
} from "@/lib/template/media-config";
import {
  getInductionLanguageChoices,
  getInductionLanguageVariant,
  hasInductionLanguageVariants,
  normalizeLanguageCode,
  parseInductionLanguageConfig,
  resolveInductionLanguageSelection,
} from "@/lib/template/language-config";
import {
  hasLmsConnectorTarget,
  parseLmsConnectorConfig,
} from "@/lib/lms/config";
import { buildLmsCompletionPayload } from "@/lib/lms/payload";
import {
  parseAccessControlConfig,
  verifyGeofenceOverrideCode,
} from "@/lib/access-control/config";
import { runIdentityOcrVerification } from "@/lib/identity-ocr";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { queueHardwareAccessDecision } from "@/lib/hardware/adapter";
import { sendSmsWithQuota } from "@/lib/sms/wrapper";
import { resolveWebhookTargetsForEvent } from "@/lib/webhook/config";
import { z } from "zod";

// Re-export types for consumers
export type {
  SignInInput,
  SignOutInput,
  VisitorType,
} from "@/lib/validation/schemas";

type PublicSignInResponse = SignInResult & {
  competencyStatus?: "CLEAR" | "EXPIRING" | "BLOCKED";
  competencyBlockedReason?: string | null;
  competencyRequirementCount?: number;
  competencyMissingCount?: number;
  competencyExpiringCount?: number;
};

const HARDWARE_ACCESS_DECISION_TIMEOUT_MS = 2_000;

const badgePrintAuditSchema = z.object({
  slug: z.string().min(1, "Site slug is required"),
  signInRecordId: z.string().cuid("Invalid sign-in record id"),
});

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

const EARTH_RADIUS_METERS = 6_371_000;
const DEFAULT_LOCATION_RADIUS_M = 150;

interface LocationAuditEvaluation {
  featureEnabled: boolean;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: Date;
  distanceMeters: number | null;
  withinSiteRadius: boolean | null;
  radiusMeters: number | null;
}

interface QuizPolicy {
  passThresholdPercent: number;
  maxAttempts: number;
  cooldownMinutes: number;
  requiredForEntry: boolean;
}

interface GeofenceGateDecision {
  blockedReason: string | null;
  overrideUsed: boolean;
  locationRequired: boolean;
}

type QuizResultPayload = NonNullable<PublicSignInInput["quizResult"]>;

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineDistanceMeters(
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number,
): number {
  const latDelta = degreesToRadians(endLatitude - startLatitude);
  const lonDelta = degreesToRadians(endLongitude - startLongitude);
  const fromLat = degreesToRadians(startLatitude);
  const toLat = degreesToRadians(endLatitude);

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lonDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

function normalizeFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number") {
    return null;
  }
  if (!Number.isFinite(value)) {
    return null;
  }
  return value;
}

function resolveLocationAuditEvaluation(input: {
  featureEnabled: boolean;
  siteLatitude: number | null;
  siteLongitude: number | null;
  siteRadiusMeters: number | null;
  submittedLocation: SignInInput["location"];
}): LocationAuditEvaluation | null {
  if (!input.featureEnabled || !input.submittedLocation) {
    return null;
  }

  const latitude = normalizeFiniteNumber(input.submittedLocation.latitude);
  const longitude = normalizeFiniteNumber(input.submittedLocation.longitude);
  if (latitude === null || longitude === null) {
    return null;
  }

  const accuracyMeters = normalizeFiniteNumber(
    input.submittedLocation.accuracyMeters,
  );

  const capturedAt = input.submittedLocation.capturedAt
    ? new Date(input.submittedLocation.capturedAt)
    : new Date();
  if (Number.isNaN(capturedAt.getTime())) {
    return null;
  }

  let distanceMeters: number | null = null;
  let withinSiteRadius: boolean | null = null;
  let radiusMeters: number | null = null;

  if (input.siteLatitude !== null && input.siteLongitude !== null) {
    distanceMeters = haversineDistanceMeters(
      input.siteLatitude,
      input.siteLongitude,
      latitude,
      longitude,
    );
    radiusMeters = input.siteRadiusMeters ?? DEFAULT_LOCATION_RADIUS_M;
    withinSiteRadius = distanceMeters <= radiusMeters;
  }

  return {
    featureEnabled: true,
    latitude,
    longitude,
    accuracyMeters,
    capturedAt,
    distanceMeters:
      distanceMeters === null ? null : Number(distanceMeters.toFixed(2)),
    withinSiteRadius,
    radiusMeters,
  };
}

function evaluateGeofenceGate(input: {
  enforcementEnabled: boolean;
  geofenceMode: "AUDIT" | "DENY" | "OVERRIDE";
  allowMissingLocation: boolean;
  locationAudit: LocationAuditEvaluation | null;
  overrideCodeHash: string | null;
  providedOverrideCode?: string | null;
}): GeofenceGateDecision {
  if (!input.enforcementEnabled || input.geofenceMode === "AUDIT") {
    return { blockedReason: null, overrideUsed: false, locationRequired: false };
  }

  const hasLocation = input.locationAudit !== null;
  const isOutsideRadius = input.locationAudit?.withinSiteRadius === false;
  const locationMissingAndRequired = !hasLocation && !input.allowMissingLocation;

  if (!isOutsideRadius && !locationMissingAndRequired) {
    return { blockedReason: null, overrideUsed: false, locationRequired: false };
  }

  if (input.geofenceMode === "DENY") {
    if (locationMissingAndRequired) {
      return {
        blockedReason:
          "Location capture is required for this site before sign-in can continue.",
        overrideUsed: false,
        locationRequired: true,
      };
    }

    return {
      blockedReason:
        "Your location is outside the allowed site radius and entry is blocked by policy.",
      overrideUsed: false,
      locationRequired: false,
    };
  }

  const overrideProvided = verifyGeofenceOverrideCode(
    input.overrideCodeHash,
    input.providedOverrideCode,
  );
  if (overrideProvided) {
    return { blockedReason: null, overrideUsed: true, locationRequired: false };
  }

  if (locationMissingAndRequired) {
    return {
      blockedReason:
        "Supervisor override code required because location capture is mandatory at this site.",
      overrideUsed: false,
      locationRequired: true,
    };
  }

  return {
    blockedReason:
      "Supervisor override code required because your location is outside the allowed site radius.",
    overrideUsed: false,
    locationRequired: false,
  };
}

function normalizeBoundedInt(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.trunc(value);
  if (normalized < minimum) return minimum;
  if (normalized > maximum) return maximum;
  return normalized;
}

function resolveQuizPolicy(
  template: {
    quiz_scoring_enabled?: unknown;
    quiz_pass_threshold?: unknown;
    quiz_max_attempts?: unknown;
    quiz_cooldown_minutes?: unknown;
    quiz_required_for_entry?: unknown;
  },
  featureEnabled: boolean,
): QuizPolicy | null {
  if (!featureEnabled || template.quiz_scoring_enabled !== true) {
    return null;
  }

  return {
    passThresholdPercent: normalizeBoundedInt(
      template.quiz_pass_threshold,
      80,
      1,
      100,
    ),
    maxAttempts: normalizeBoundedInt(template.quiz_max_attempts, 3, 1, 10),
    cooldownMinutes: normalizeBoundedInt(
      template.quiz_cooldown_minutes,
      15,
      0,
      1440,
    ),
    requiredForEntry: template.quiz_required_for_entry !== false,
  };
}

async function evaluateQuizAttemptAndPersist(input: {
  companyId: string;
  siteId: string;
  templateId: string;
  templateQuestions: Array<{
    id: string;
    question_type?: string;
    correct_answer?: unknown;
  }>;
  answers: SignInInput["answers"];
  visitorPhoneE164: string;
  quizPolicy: QuizPolicy;
}): Promise<{
  quizResult: QuizResultPayload;
  blockedReason?: string;
}> {
  const score = evaluateQuizScore(
    input.templateQuestions.map((question) => ({
      id: question.id,
      questionType: question.question_type,
      correctAnswer: question.correct_answer,
    })),
    input.answers.map((answer) => ({
      questionId: answer.questionId,
      answer: answer.answer,
    })),
    input.quizPolicy.passThresholdPercent,
  );

  const previousAttempt = await findInductionQuizAttemptState(input.companyId, {
    siteId: input.siteId,
    templateId: input.templateId,
    visitorPhoneE164: input.visitorPhoneE164,
  });

  const now = new Date();
  const previousFailures = previousAttempt?.failed_attempts ?? 0;
  let nextFailedAttempts = 0;
  let cooldownUntil: Date | null = null;
  let attemptsRemaining = input.quizPolicy.maxAttempts;

  if (score.passed) {
    nextFailedAttempts = 0;
    cooldownUntil = null;
    attemptsRemaining = input.quizPolicy.maxAttempts;
  } else {
    const failedAttemptCount = previousFailures + 1;
    if (failedAttemptCount >= input.quizPolicy.maxAttempts) {
      nextFailedAttempts = 0;
      cooldownUntil =
        input.quizPolicy.cooldownMinutes > 0
          ? new Date(now.getTime() + input.quizPolicy.cooldownMinutes * 60_000)
          : now;
      attemptsRemaining = 0;
    } else {
      nextFailedAttempts = failedAttemptCount;
      attemptsRemaining = input.quizPolicy.maxAttempts - failedAttemptCount;
    }
  }

  await upsertInductionQuizAttemptState(input.companyId, {
    siteId: input.siteId,
    templateId: input.templateId,
    visitorPhoneE164: input.visitorPhoneE164,
    failedAttempts: nextFailedAttempts,
    cooldownUntil,
    lastAttemptAt: now,
    lastScorePercent: score.scorePercent,
    lastPassed: score.passed,
  });

  const quizResult: QuizResultPayload = {
    passed: score.passed,
    scorePercent: score.scorePercent,
    thresholdPercent: input.quizPolicy.passThresholdPercent,
    gradedQuestionCount: score.gradedQuestionCount,
    correctCount: score.correctCount,
    requiredForEntry: input.quizPolicy.requiredForEntry,
    maxAttempts: input.quizPolicy.maxAttempts,
    cooldownMinutes: input.quizPolicy.cooldownMinutes,
  };

  if (!score.passed && input.quizPolicy.requiredForEntry) {
    const reasonBase = `Quiz score ${score.scorePercent}% is below the required ${input.quizPolicy.passThresholdPercent}% pass mark.`;
    const reason =
      cooldownUntil !== null
        ? `${reasonBase} Retry is available after ${cooldownUntil.toISOString()}.`
        : `${reasonBase} ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining before cooldown.`;

    return {
      quizResult,
      blockedReason: reason,
    };
  }

  return { quizResult };
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

function buildPublicSignInResponse(
  result: SignInResult,
  competencyEvaluation: CompetencyEvaluation,
): PublicSignInResponse {
  return {
    ...result,
    competencyStatus: competencyEvaluation.status,
    competencyBlockedReason: competencyEvaluation.blockedReason,
    competencyRequirementCount: competencyEvaluation.requirementCount,
    competencyMissingCount: competencyEvaluation.missingCount,
    competencyExpiringCount: competencyEvaluation.expiringCount,
  };
}

function competencyDecisionSummary(
  evaluation: CompetencyEvaluation,
): {
  status: CompetencyEvaluation["status"];
  blockedReason: string | null;
  requirementCount: number;
  missingCount: number;
  expiringCount: number;
  requirements: Array<{
    requirementId: string;
    requirementName: string;
    state: string;
    message: string;
    certificationId: string | null;
    certificationStatus: string | null;
    certificationExpiresAt: string | null;
  }>;
} {
  return {
    status: evaluation.status,
    blockedReason: evaluation.blockedReason,
    requirementCount: evaluation.requirementCount,
    missingCount: evaluation.missingCount,
    expiringCount: evaluation.expiringCount,
    requirements: evaluation.requirements.map((entry) => ({
      requirementId: entry.requirement.id,
      requirementName: entry.requirement.name,
      state: entry.state,
      message: entry.message,
      certificationId: entry.certification?.id ?? null,
      certificationStatus: entry.certification?.status ?? null,
      certificationExpiresAt:
        entry.certification?.expires_at?.toISOString() ?? null,
    })),
  };
}

function buildHostArrivalEmailBody(input: {
  siteName: string;
  visitorName: string;
  visitorType: string;
  signInTime: Date;
  employerName?: string;
  roleOnSite?: string;
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  const liveRegisterLink = appUrl
    ? `${appUrl}/admin/live-register`
    : "/admin/live-register";

  const employerMarkup = input.employerName
    ? `<p><strong>Employer:</strong> ${escapeHtml(input.employerName)}</p>`
    : "";
  const roleMarkup = input.roleOnSite
    ? `<p><strong>Role on site:</strong> ${escapeHtml(input.roleOnSite)}</p>`
    : "";

  return `
    <h1>Visitor Arrival Notification</h1>
    <p>A visitor has completed induction and checked in.</p>
    <p><strong>Site:</strong> ${escapeHtml(input.siteName)}</p>
    <p><strong>Name:</strong> ${escapeHtml(input.visitorName)}</p>
    <p><strong>Type:</strong> ${escapeHtml(input.visitorType)}</p>
    ${employerMarkup}
    ${roleMarkup}
    <p><strong>Check-in time:</strong> ${escapeHtml(input.signInTime.toISOString())}</p>
    <p><a href="${liveRegisterLink}">Open Live Register</a></p>
  `;
}

interface HostNotificationDeliverySummary {
  featureEnabled: boolean;
  targets: number;
  queued: number;
}

async function queueHostArrivalNotifications(input: {
  companyId: string;
  siteId: string;
  siteName: string;
  visitorName: string;
  visitorType: string;
  signInTime: Date;
  employerName?: string;
  roleOnSite?: string;
  selectedHostRecipientId?: string;
  requestId: string;
  log: ReturnType<typeof createRequestLogger>;
}): Promise<HostNotificationDeliverySummary> {
  try {
    await assertCompanyFeatureEnabled(
      input.companyId,
      "HOST_NOTIFICATIONS",
      input.siteId,
    );
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      input.log.info(
        {
          requestId: input.requestId,
          companyId: input.companyId,
          siteId: input.siteId,
          featureKey: error.featureKey,
        },
        "Host notifications disabled by plan entitlement",
      );
      return { featureEnabled: false, targets: 0, queued: 0 };
    }

    input.log.error(
      {
        requestId: input.requestId,
        companyId: input.companyId,
        siteId: input.siteId,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to resolve host-notification entitlements",
    );
    return { featureEnabled: false, targets: 0, queued: 0 };
  }

  try {
    const recipients = await listSiteManagerNotificationRecipients(
      input.companyId,
      input.siteId,
    );
    const filteredRecipients = input.selectedHostRecipientId
      ? recipients.filter(
          (recipient) => recipient.userId === input.selectedHostRecipientId,
        )
      : recipients;

    if (input.selectedHostRecipientId && filteredRecipients.length === 0) {
      input.log.warn(
        {
          requestId: input.requestId,
          siteId: input.siteId,
          selectedHostRecipientId: input.selectedHostRecipientId,
        },
        "Selected host recipient was not found in site notification recipients",
      );
    }

    if (filteredRecipients.length === 0) {
      return { featureEnabled: true, targets: 0, queued: 0 };
    }

    const queueResults = await Promise.allSettled(
      filteredRecipients.map((recipient) =>
        queueEmailNotification(input.companyId, {
          user_id: recipient.userId,
          to: recipient.email,
          subject: `Arrival: ${input.visitorName} checked in at ${input.siteName}`,
          body: buildHostArrivalEmailBody({
            siteName: input.siteName,
            visitorName: input.visitorName,
            visitorType: input.visitorType,
            signInTime: input.signInTime,
            employerName: input.employerName,
            roleOnSite: input.roleOnSite,
          }),
        }),
      ),
    );

    const queued = queueResults.filter(
      (result) => result.status === "fulfilled",
    ).length;
    const queueFailures = queueResults.length - queued;

    if (queueFailures > 0) {
      input.log.error(
        {
          requestId: input.requestId,
          siteId: input.siteId,
          queueFailures,
          queueTargets: queueResults.length,
        },
        "Failed to queue one or more host arrival notifications",
      );
    }

    return {
      featureEnabled: true,
      targets: filteredRecipients.length,
      queued,
    };
  } catch (error) {
    input.log.error(
      {
        requestId: input.requestId,
        companyId: input.companyId,
        siteId: input.siteId,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to resolve or queue host arrival notifications",
    );
    return { featureEnabled: true, targets: 0, queued: 0 };
  }
}

function resolveAppUrlBase(): string | null {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!value) return null;
  return value.replace(/\/$/, "");
}

async function sendChannelEventsForSite(input: {
  companyId: string;
  siteId: string;
  eventType: string;
  payload?: Record<string, unknown>;
  payloadForConfig?: (
    config: Awaited<ReturnType<typeof listChannelIntegrationConfigs>>[number],
  ) => Record<string, unknown>;
  provider?: "TEAMS" | "SLACK";
  requestId: string;
  log: ReturnType<typeof createRequestLogger>;
}) {
  if (!FEATURE_FLAGS.TEAMS_SLACK_V1) {
    return;
  }

  try {
    await assertCompanyFeatureEnabled(input.companyId, "TEAMS_SLACK_V1", input.siteId);
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return;
    }
    throw error;
  }

  const configs = await listChannelIntegrationConfigs(input.companyId, {
    site_id: input.siteId,
    include_global_for_site: true,
    only_active: true,
    ...(input.provider ? { provider: input.provider } : {}),
  });

  const targets = filterChannelIntegrationConfigsForEvent(configs, {
    event_type: input.eventType,
    site_id: input.siteId,
    ...(input.provider ? { provider: input.provider } : {}),
  });
  if (targets.length === 0) {
    return;
  }

  const deliveries = await Promise.allSettled(
    targets.map(async (config) => {
      const payload =
        input.payloadForConfig?.(config) ??
        input.payload ?? {
          event_type: input.eventType,
        };

      const delivery = await createChannelDelivery(input.companyId, {
        integration_config_id: config.id,
        event_type: input.eventType,
        payload,
      });

      try {
        const headers: Record<string, string> = {
          "content-type": "application/json",
          "x-inductlite-event-type": input.eventType,
          "x-inductlite-delivery-id": delivery.id,
        };
        if (config.auth_token) {
          headers.authorization = `Bearer ${config.auth_token}`;
        }

        const response = await fetch(config.endpoint_url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        const responseBody = await response.text();
        await markChannelDeliveryStatus(input.companyId, {
          delivery_id: delivery.id,
          status: response.ok ? "SENT" : "FAILED",
          response_status_code: response.status,
          response_body: responseBody.slice(0, 1500),
          increment_retry: !response.ok,
        });

        await createCommunicationEvent(input.companyId, {
          site_id: input.siteId,
          direction: "OUTBOUND",
          channel: config.provider,
          event_type: `${input.eventType}.dispatch`,
          status: response.ok ? "sent" : "failed",
          payload: {
            integration_config_id: config.id,
            response_status_code: response.status,
          },
        });
      } catch (error) {
        await markChannelDeliveryStatus(input.companyId, {
          delivery_id: delivery.id,
          status: "FAILED",
          response_body:
            error instanceof Error ? error.message : "Channel dispatch failed",
          increment_retry: true,
        });
      }
    }),
  );

  const failed = deliveries.filter((result) => result.status === "rejected").length;
  if (failed > 0) {
    input.log.error(
      {
        requestId: input.requestId,
        companyId: input.companyId,
        siteId: input.siteId,
        eventType: input.eventType,
        failedDeliveries: failed,
      },
      "One or more channel event deliveries failed",
    );
  }
}

async function triggerOutboundWebhooks(input: {
  companyId: string;
  siteId: string;
  site: unknown;
  result: SignInResult;
  requestId: string;
  log: ReturnType<typeof createRequestLogger>;
}) {
  const siteWithWebhooks = input.site as { webhooks?: unknown };
  const webhookTargets = resolveWebhookTargetsForEvent(
    siteWithWebhooks.webhooks,
    "induction.completed",
  );
  if (webhookTargets.length === 0) {
    return;
  }

  try {
    await assertCompanyFeatureEnabled(
      input.companyId,
      "WEBHOOKS_OUTBOUND",
      input.siteId,
    );
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      input.log.info(
        {
          requestId: input.requestId,
          companyId: input.companyId,
          siteId: input.siteId,
          featureKey: error.featureKey,
        },
        "Outbound webhooks disabled by plan entitlement",
      );
      return;
    }

    input.log.error(
      {
        requestId: input.requestId,
        companyId: input.companyId,
        siteId: input.siteId,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to resolve outbound webhook entitlements",
    );
    return;
  }

  try {
    const queuedCount = await queueOutboundWebhookDeliveries(input.companyId, [
      ...webhookTargets.map((targetUrl) => ({
        siteId: input.siteId,
        eventType: "induction.completed",
        targetUrl,
        payload: {
          event: "induction.completed",
          occurredAt: new Date().toISOString(),
          data: {
            signInRecordId: input.result.signInRecordId,
            signOutToken: input.result.signOutToken,
            signOutTokenExpiresAt: input.result.signOutTokenExpiresAt.toISOString(),
            visitorName: input.result.visitorName,
            siteName: input.result.siteName,
            signInTime: input.result.signInTime.toISOString(),
          },
        },
      })),
    ]);

    input.log.info(
      {
        requestId: input.requestId,
        companyId: input.companyId,
        siteId: input.siteId,
        queuedCount,
      },
      "Queued outbound webhooks",
    );
  } catch (error) {
    input.log.error(
      {
        requestId: input.requestId,
        companyId: input.companyId,
        siteId: input.siteId,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to queue outbound webhooks",
    );
  }
}

async function triggerLmsCompletionSync(input: {
  companyId: string;
  siteId: string;
  site: unknown;
  result: SignInResult;
  requestId: string;
  log: ReturnType<typeof createRequestLogger>;
}) {
  const connectorConfig = parseLmsConnectorConfig(
    (input.site as { lms_connector?: unknown }).lms_connector,
  );
  if (!hasLmsConnectorTarget(connectorConfig) || !connectorConfig.endpointUrl) {
    return;
  }

  try {
    await assertCompanyFeatureEnabled(
      input.companyId,
      "LMS_CONNECTOR",
      input.siteId,
    );
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      input.log.info(
        {
          requestId: input.requestId,
          companyId: input.companyId,
          siteId: input.siteId,
          featureKey: error.featureKey,
        },
        "LMS connector disabled by plan entitlement",
      );
      return;
    }

    input.log.error(
      {
        requestId: input.requestId,
        companyId: input.companyId,
        siteId: input.siteId,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to resolve LMS connector entitlements",
    );
    return;
  }

  try {
    const payloadMapping = buildLmsCompletionPayload({
      provider: connectorConfig.provider,
      courseCode: connectorConfig.courseCode,
      siteId: input.siteId,
      result: input.result,
      occurredAt: new Date(),
    });

    const queuedCount = await queueOutboundWebhookDeliveries(input.companyId, [
      {
        siteId: input.siteId,
        eventType: "lms.completion",
        targetUrl: connectorConfig.endpointUrl,
        payload: payloadMapping.payload,
      },
    ]);

    input.log.info(
      {
        requestId: input.requestId,
        companyId: input.companyId,
        siteId: input.siteId,
        queuedCount,
        provider: payloadMapping.provider,
      },
      "Queued LMS completion sync deliveries",
    );
  } catch (error) {
    input.log.error(
      {
        requestId: input.requestId,
        companyId: input.companyId,
        siteId: input.siteId,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to queue LMS completion sync deliveries",
    );
  }
}

async function triggerHardwareAccessDecision(input: {
  companyId: string;
  siteId: string;
  siteName: string;
  site: unknown;
  decision: "ALLOW" | "DENY";
  reason: string;
  signInRecordId?: string;
  visitorName?: string;
  visitorPhoneE164?: string;
  requestId: string;
  log: ReturnType<typeof createRequestLogger>;
  metadata?: Record<string, unknown>;
}) {
  try {
    const result = await Promise.race([
      queueHardwareAccessDecision({
        companyId: input.companyId,
        siteId: input.siteId,
        siteName: input.siteName,
        accessControl: (input.site as { access_control?: unknown }).access_control,
        decision: input.decision,
        reason: input.reason,
        signInRecordId: input.signInRecordId,
        visitorName: input.visitorName,
        visitorPhoneE164: input.visitorPhoneE164,
        requestId: input.requestId,
        metadata: input.metadata,
      }),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), HARDWARE_ACCESS_DECISION_TIMEOUT_MS);
      }),
    ]);

    if (result === null) {
      input.log.warn(
        {
          requestId: input.requestId,
          companyId: input.companyId,
          siteId: input.siteId,
          decision: input.decision,
          reason: input.reason,
          timeoutMs: HARDWARE_ACCESS_DECISION_TIMEOUT_MS,
        },
        "Hardware access decision timed out; continuing public flow",
      );
      return;
    }

    if (result.queued) {
      input.log.info(
        {
          requestId: input.requestId,
          companyId: input.companyId,
          siteId: input.siteId,
          decision: input.decision,
          reason: input.reason,
        },
        "Queued hardware access decision delivery",
      );
    }
  } catch (error) {
    input.log.error(
      {
        requestId: input.requestId,
        companyId: input.companyId,
        siteId: input.siteId,
        decision: input.decision,
        reason: input.reason,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to queue hardware access decision",
    );
  }
}

async function sendVisitorSmsReceipt(input: {
  companyId: string;
  siteId: string;
  siteName: string;
  visitorName: string;
  visitorPhoneE164: string;
  signOutToken: string;
  requestId: string;
  log: ReturnType<typeof createRequestLogger>;
}): Promise<"SENT" | "DISABLED" | "DENIED" | "FAILED"> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const signOutUrl = appUrl
    ? `${appUrl.replace(/\/$/, "")}/sign-out?token=${encodeURIComponent(input.signOutToken)}`
    : null;
  const message = signOutUrl
    ? `${input.visitorName}, you are checked in at ${input.siteName}. Sign out when leaving: ${signOutUrl}`
    : `${input.visitorName}, you are checked in at ${input.siteName}.`;

  try {
    const smsResult = await sendSmsWithQuota({
      companyId: input.companyId,
      siteId: input.siteId,
      toE164: input.visitorPhoneE164,
      message,
      requestId: input.requestId,
      metadata: {
        trigger: "visitor_sign_in_receipt",
      },
    });

    if (smsResult.status === "FAILED") {
      input.log.warn(
        {
          requestId: input.requestId,
          companyId: input.companyId,
          siteId: input.siteId,
          reason: smsResult.reason,
          controlId: smsResult.controlId,
        },
        "SMS receipt send failed",
      );
    }

    return smsResult.status;
  } catch (error) {
    input.log.error(
      {
        requestId: input.requestId,
        companyId: input.companyId,
        siteId: input.siteId,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Unexpected SMS receipt send error",
    );
    return "FAILED";
  }
}

async function markInviteUsedIfNeeded(input: {
  companyId: string;
  inviteId?: string;
  signInRecordId: string;
  requestId: string;
  log: ReturnType<typeof createRequestLogger>;
}) {
  if (!input.inviteId) {
    return;
  }

  try {
    await markPreRegistrationInviteUsed(
      input.companyId,
      input.inviteId,
      input.signInRecordId,
    );
  } catch (error) {
    input.log.error(
      {
        requestId: input.requestId,
        companyId: input.companyId,
        inviteId: input.inviteId,
        signInRecordId: input.signInRecordId,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to mark pre-registration invite as used",
    );
  }
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
  hostRecipients?: Array<{
    id: string;
    name: string;
  }>;
  locationAudit?: {
    enabled: boolean;
    siteLatitude: number | null;
    siteLongitude: number | null;
    siteRadiusMeters: number | null;
  };
  geofence?: {
    enforcementEnabled: boolean;
    mode: "AUDIT" | "DENY" | "OVERRIDE";
    allowMissingLocation: boolean;
    requiresOverrideCode: boolean;
  };
  identityEvidence?: {
    enabled: boolean;
    requirePhoto: boolean;
    requireIdScan: boolean;
    requireConsent: boolean;
    requireOcrVerification: boolean;
    allowedDocumentTypes: string[];
    ocrDecisionMode: "assist" | "strict";
  };
}

export interface TemplateInfo {
  id: string;
  name: string;
  version: number;
  description: string | null;
  language: {
    enabled: boolean;
    defaultLanguage: string;
    available: Array<{
      code: string;
      label: string;
    }>;
    variants: Array<{
      languageCode: string;
      label: string;
      templateName: string | null;
      templateDescription: string | null;
      acknowledgementLabel: string | null;
      questions: Array<{
        questionId: string;
        questionText: string | null;
        optionLabels: string[] | null;
      }>;
    }>;
  };
  media: {
    enabled: boolean;
    requireAcknowledgement: boolean;
    acknowledgementLabel: string;
    blocks: Array<{
      id: string;
      type: "TEXT" | "PDF" | "IMAGE";
      title: string;
      body: string | null;
      url: string | null;
      sortOrder: number;
    }>;
  };
  quiz?: {
    enabled: boolean;
    passThresholdPercent: number;
    maxAttempts: number;
    cooldownMinutes: number;
    requiredForEntry: boolean;
  };
  questions: Array<{
    id: string;
    questionText: string;
    questionType: string;
    options: string[] | null;
    isRequired: boolean;
    redFlag: boolean;
    displayOrder: number;
    logic?: unknown;
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

    const [emergencyContacts, emergencyProcedures, legalVersions, hostRecipients] =
      await Promise.all([
        listSiteEmergencyContacts(site.company.id, site.id),
        listSiteEmergencyProcedures(site.company.id, site.id),
        getOrCreateActiveLegalVersions(site.company.id),
        listSiteManagerNotificationRecipients(site.company.id, site.id),
      ]);

    const consentStatement = buildConsentStatement({
      siteName: site.name,
      includeEmergencyReminder: true,
    });
    const accessControlConfig = parseAccessControlConfig(site.access_control);
    const inductionMedia = parseInductionMediaConfig(template.induction_media);
    const languageConfig = parseInductionLanguageConfig(
      template.induction_languages,
    );
    const languageChoices = getInductionLanguageChoices(languageConfig);

    let locationAuditEnabled = false;
    try {
      await assertCompanyFeatureEnabled(
        site.company.id,
        "LOCATION_AUDIT",
        site.id,
      );
      locationAuditEnabled = true;
    } catch (error) {
      if (!(error instanceof EntitlementDeniedError)) {
        throw error;
      }
    }

    let multiLanguageEnabled = false;
    try {
      await assertCompanyFeatureEnabled(site.company.id, "MULTI_LANGUAGE", site.id);
      multiLanguageEnabled = true;
    } catch (error) {
      if (!(error instanceof EntitlementDeniedError)) {
        throw error;
      }
    }

    let identityHardeningEnabled = false;
    try {
      await assertCompanyFeatureEnabled(site.company.id, "ID_HARDENING_V1", site.id);
      identityHardeningEnabled = true;
    } catch (error) {
      if (!(error instanceof EntitlementDeniedError)) {
        throw error;
      }
    }

    let identityOcrEnabled = false;
    if (identityHardeningEnabled) {
      try {
        await assertCompanyFeatureEnabled(
          site.company.id,
          "ID_OCR_VERIFICATION_V1",
          site.id,
        );
        identityOcrEnabled = true;
      } catch (error) {
        if (!(error instanceof EntitlementDeniedError)) {
          throw error;
        }
      }
    }

    let contentBlocksEnabled = false;
    try {
      await assertCompanyFeatureEnabled(site.company.id, "CONTENT_BLOCKS", site.id);
      contentBlocksEnabled = true;
    } catch (error) {
      if (!(error instanceof EntitlementDeniedError)) {
        throw error;
      }
    }

    let quizScoringFeatureEnabled = false;
    try {
      await assertCompanyFeatureEnabled(site.company.id, "QUIZ_SCORING_V2", site.id);
      quizScoringFeatureEnabled = true;
    } catch (error) {
      if (!(error instanceof EntitlementDeniedError)) {
        throw error;
      }
    }

    let geofenceEnforcementEnabled = false;
    if (accessControlConfig.geofence.mode !== "AUDIT") {
      try {
        await assertCompanyFeatureEnabled(
          site.company.id,
          "GEOFENCE_ENFORCEMENT",
          site.id,
        );
        geofenceEnforcementEnabled = true;
      } catch (error) {
        if (!(error instanceof EntitlementDeniedError)) {
          throw error;
        }
      }
    }

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
        hostRecipients: hostRecipients.map((recipient) => ({
          id: recipient.userId,
          name: recipient.name,
        })),
        locationAudit: {
          enabled: locationAuditEnabled,
          siteLatitude: normalizeFiniteNumber(site.location_latitude),
          siteLongitude: normalizeFiniteNumber(site.location_longitude),
          siteRadiusMeters:
            site.location_latitude !== null && site.location_longitude !== null
              ? site.location_radius_m ?? DEFAULT_LOCATION_RADIUS_M
              : null,
        },
        geofence: {
          enforcementEnabled: geofenceEnforcementEnabled,
          mode: geofenceEnforcementEnabled
            ? accessControlConfig.geofence.mode
            : "AUDIT",
          allowMissingLocation: accessControlConfig.geofence.allowMissingLocation,
          requiresOverrideCode:
            geofenceEnforcementEnabled &&
            accessControlConfig.geofence.mode === "OVERRIDE" &&
            accessControlConfig.geofence.overrideCodeHash !== null,
        },
        identityEvidence: {
          enabled: identityHardeningEnabled && accessControlConfig.identity.enabled,
          requirePhoto:
            identityHardeningEnabled && accessControlConfig.identity.requirePhoto,
          requireIdScan:
            identityHardeningEnabled && accessControlConfig.identity.requireIdScan,
          requireConsent:
            identityHardeningEnabled && accessControlConfig.identity.requireConsent,
          requireOcrVerification:
            identityHardeningEnabled &&
            identityOcrEnabled &&
            accessControlConfig.identity.requireOcrVerification,
          allowedDocumentTypes: accessControlConfig.identity.allowedDocumentTypes,
          ocrDecisionMode: accessControlConfig.identity.ocrDecisionMode,
        },
      },
      template: {
        id: template.id,
        name: template.name,
        version: template.version,
        description: template.description,
        language: {
          enabled:
            multiLanguageEnabled && hasInductionLanguageVariants(languageConfig),
          defaultLanguage: languageConfig.defaultLanguage,
          available: multiLanguageEnabled
            ? languageChoices
            : [languageChoices[0] ?? { code: languageConfig.defaultLanguage, label: languageConfig.defaultLanguage.toUpperCase() }],
          variants: multiLanguageEnabled ? languageConfig.variants : [],
        },
        media: {
          enabled: contentBlocksEnabled && hasInductionMedia(inductionMedia),
          requireAcknowledgement:
            contentBlocksEnabled && inductionMedia.requireAcknowledgement,
          acknowledgementLabel: inductionMedia.acknowledgementLabel,
          blocks: contentBlocksEnabled ? inductionMedia.blocks : [],
        },
        quiz: {
          enabled: quizScoringFeatureEnabled && template.quiz_scoring_enabled === true,
          passThresholdPercent: normalizeBoundedInt(
            template.quiz_pass_threshold,
            80,
            1,
            100,
          ),
          maxAttempts: normalizeBoundedInt(template.quiz_max_attempts, 3, 1, 10),
          cooldownMinutes: normalizeBoundedInt(
            template.quiz_cooldown_minutes,
            15,
            0,
            1440,
          ),
          requiredForEntry: template.quiz_required_for_entry !== false,
        },
        questions: template.questions.map((q) => ({
          id: q.id,
          questionText: q.question_text,
          questionType: q.question_type,
          options: q.options as string[] | null,
          isRequired: q.is_required,
          redFlag: q.red_flag,
          displayOrder: q.display_order,
          logic: q.logic,
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
): Promise<ApiResponse<PublicSignInResponse>> {
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
    parsed.error.issues.forEach((e) => {
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

    let preRegistrationInviteId: string | undefined;
    if (parsed.data.inviteToken) {
      try {
        await assertCompanyFeatureEnabled(
          site.company.id,
          "PREREG_INVITES",
          site.id,
        );
      } catch (error) {
        if (error instanceof EntitlementDeniedError) {
          return errorResponse(
            "FORBIDDEN",
            "Pre-registration invites are not enabled for this site plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
          );
        }
        throw error;
      }

      const invite = await findActivePreRegistrationInviteByToken(
        site.company.id,
        site.id,
        parsed.data.inviteToken,
      );
      if (!invite) {
        return validationErrorResponse(
          { inviteToken: ["Invite link is invalid, expired, or already used"] },
          "Invalid invite link",
        );
      }
      preRegistrationInviteId = invite.id;
    }

    let locationAuditFeatureEnabled = false;
    try {
      await assertCompanyFeatureEnabled(
        site.company.id,
        "LOCATION_AUDIT",
        site.id,
      );
      locationAuditFeatureEnabled = true;
    } catch (error) {
      if (!(error instanceof EntitlementDeniedError)) {
        throw error;
      }
    }

    const locationAudit = resolveLocationAuditEvaluation({
      featureEnabled: locationAuditFeatureEnabled,
      siteLatitude: normalizeFiniteNumber(site.location_latitude),
      siteLongitude: normalizeFiniteNumber(site.location_longitude),
      siteRadiusMeters:
        site.location_radius_m ?? DEFAULT_LOCATION_RADIUS_M,
      submittedLocation: parsed.data.location,
    });
    const accessControlConfig = parseAccessControlConfig(site.access_control);

    let geofenceEnforcementFeatureEnabled = false;
    if (accessControlConfig.geofence.mode !== "AUDIT") {
      try {
        await assertCompanyFeatureEnabled(
          site.company.id,
          "GEOFENCE_ENFORCEMENT",
          site.id,
        );
        geofenceEnforcementFeatureEnabled = true;
      } catch (error) {
        if (!(error instanceof EntitlementDeniedError)) {
          throw error;
        }
      }
    }

    const geofenceGate = evaluateGeofenceGate({
      enforcementEnabled: geofenceEnforcementFeatureEnabled,
      geofenceMode: accessControlConfig.geofence.mode,
      allowMissingLocation: accessControlConfig.geofence.allowMissingLocation,
      locationAudit,
      overrideCodeHash: accessControlConfig.geofence.overrideCodeHash,
      providedOverrideCode: parsed.data.geofenceOverrideCode,
    });

    if (geofenceGate.blockedReason) {
      await triggerHardwareAccessDecision({
        companyId: site.company.id,
        siteId: site.id,
        siteName: site.name,
        site,
        decision: "DENY",
        reason: "geofence_policy_blocked",
        visitorName: parsed.data.visitorName,
        requestId,
        log,
        metadata: {
          mode: accessControlConfig.geofence.mode,
          location_required: geofenceGate.locationRequired,
        },
      });

      try {
        const [ip, userAgent] = await Promise.all([getClientIp(), getUserAgent()]);
        await createAuditLog(site.company.id, {
          action: "visitor.sign_in_blocked",
          entity_type: "Site",
          entity_id: site.id,
          user_id: undefined,
          details: {
            reason: "geofence_policy_blocked",
            geofence_mode: accessControlConfig.geofence.mode,
            location_required: geofenceGate.locationRequired,
            location_within_site_radius: locationAudit?.withinSiteRadius ?? null,
            location_distance_m: locationAudit?.distanceMeters ?? null,
            visitor_type: parsed.data.visitorType,
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
            auditErrorType:
              auditError instanceof Error ? auditError.name : "unknown",
          },
          "Failed to persist geofence block audit event",
        );
      }

      return validationErrorResponse(
        {
          location: [geofenceGate.blockedReason],
        },
        "Geofence policy blocked this sign-in",
      );
    }

    let identityEvidenceFeatureEnabled = false;
    if (accessControlConfig.identity.enabled) {
      try {
        await assertCompanyFeatureEnabled(
          site.company.id,
          "ID_HARDENING_V1",
          site.id,
        );
        identityEvidenceFeatureEnabled = true;
      } catch (error) {
        if (!(error instanceof EntitlementDeniedError)) {
          throw error;
        }
      }
    }
    const identityEvidenceEnabled =
      identityEvidenceFeatureEnabled && accessControlConfig.identity.enabled;
    const identityPhotoRequired =
      identityEvidenceEnabled && accessControlConfig.identity.requirePhoto;
    const identityIdScanRequired =
      identityEvidenceEnabled && accessControlConfig.identity.requireIdScan;
    const identityConsentRequired =
      identityEvidenceEnabled && accessControlConfig.identity.requireConsent;

    if (identityPhotoRequired && !parsed.data.visitorPhotoDataUrl) {
      return validationErrorResponse(
        {
          visitorPhotoDataUrl: [
            "A visitor photo is required before sign-in can continue.",
          ],
        },
        "Visitor photo evidence required",
      );
    }

    if (identityIdScanRequired && !parsed.data.visitorIdDataUrl) {
      return validationErrorResponse(
        {
          visitorIdDataUrl: ["A visitor ID image is required for this site."],
        },
        "Visitor ID evidence required",
      );
    }

    if (identityConsentRequired && parsed.data.identityConsentAccepted !== true) {
      return validationErrorResponse(
        {
          identityConsentAccepted: [
            "You must consent to identity evidence processing for this site.",
          ],
        },
        "Identity evidence consent is required",
      );
    }

    const identityEvidence = identityEvidenceEnabled
      ? {
          visitorPhotoDataUrl: parsed.data.visitorPhotoDataUrl,
          visitorIdDataUrl: parsed.data.visitorIdDataUrl,
          visitorIdType: parsed.data.visitorIdType,
          consentAccepted: parsed.data.identityConsentAccepted === true,
        }
      : undefined;

    let identityOcrFeatureEnabled = false;
    if (identityEvidenceEnabled && accessControlConfig.identity.requireOcrVerification) {
      try {
        await assertCompanyFeatureEnabled(
          site.company.id,
          "ID_OCR_VERIFICATION_V1",
          site.id,
        );
        identityOcrFeatureEnabled = true;
      } catch (error) {
        if (!(error instanceof EntitlementDeniedError)) {
          throw error;
        }
      }
    }

    const identityOcrRequired =
      identityEvidenceEnabled &&
      identityOcrFeatureEnabled &&
      accessControlConfig.identity.requireOcrVerification &&
      Boolean(parsed.data.visitorIdDataUrl);

    let identityOcrDecisionStatus: string | null = null;
    let identityOcrReasonCode: string | null = null;
    let identityOcrExecuted = false;

    if (identityOcrRequired && parsed.data.visitorIdDataUrl) {
      const ocrResult = await runIdentityOcrVerification({
        companyId: site.company.id,
        siteId: site.id,
        visitorName: parsed.data.visitorName,
        documentImageDataUrl: parsed.data.visitorIdDataUrl,
        documentType: parsed.data.visitorIdType ?? null,
        allowedDocumentTypes: accessControlConfig.identity.allowedDocumentTypes,
        decisionMode: accessControlConfig.identity.ocrDecisionMode,
      });

      if (ocrResult.controlError) {
        return ocrResult.controlError;
      }

      identityOcrExecuted = ocrResult.executed;
      identityOcrDecisionStatus = ocrResult.decisionStatus;
      identityOcrReasonCode = ocrResult.reasonCode;

      if (
        accessControlConfig.identity.ocrDecisionMode === "strict" &&
        ocrResult.executed &&
        ocrResult.decisionStatus !== "APPROVED"
      ) {
        const [ip, userAgent] = await Promise.all([getClientIp(), getUserAgent()]);
        await createAuditLog(site.company.id, {
          action: "visitor.sign_in_blocked",
          entity_type: "Site",
          entity_id: site.id,
          user_id: undefined,
          details: {
            reason: "identity_ocr_strict_policy_blocked",
            ocr_decision_status: ocrResult.decisionStatus,
            ocr_reason_code: ocrResult.reasonCode,
            ocr_decision_mode: accessControlConfig.identity.ocrDecisionMode,
            visitor_type: parsed.data.visitorType,
          },
          ip_address: ip,
          user_agent: userAgent,
          request_id: requestId,
        });

        await triggerHardwareAccessDecision({
          companyId: site.company.id,
          siteId: site.id,
          siteName: site.name,
          site,
          decision: "DENY",
          reason: "identity_ocr_strict_policy_blocked",
          visitorName: parsed.data.visitorName,
          visitorPhoneE164:
            formatToE164(parsed.data.visitorPhone, "NZ") ?? undefined,
          requestId,
          log,
          metadata: {
            ocrDecisionStatus: ocrResult.decisionStatus,
            ocrReasonCode: ocrResult.reasonCode,
          },
        });

        return validationErrorResponse(
          {
            visitorIdDataUrl: [
              "ID verification needs manual review before sign-in can continue.",
            ],
          },
          "Identity OCR verification requires manual review",
        );
      }
    }

    let quizScoringFeatureEnabled = false;
    try {
      await assertCompanyFeatureEnabled(
        site.company.id,
        "QUIZ_SCORING_V2",
        site.id,
      );
      quizScoringFeatureEnabled = true;
    } catch (error) {
      if (!(error instanceof EntitlementDeniedError)) {
        throw error;
      }
    }

    const quizPolicy = resolveQuizPolicy(template, quizScoringFeatureEnabled);
    const mediaConfig = parseInductionMediaConfig(template.induction_media);
    let contentBlocksFeatureEnabled = false;
    try {
      await assertCompanyFeatureEnabled(site.company.id, "CONTENT_BLOCKS", site.id);
      contentBlocksFeatureEnabled = true;
    } catch (error) {
      if (!(error instanceof EntitlementDeniedError)) {
        throw error;
      }
    }
    const effectiveMediaConfig = contentBlocksFeatureEnabled
      ? mediaConfig
      : parseInductionMediaConfig(null);
    const mediaEvidence = {
      enabled: hasInductionMedia(effectiveMediaConfig),
      requireAcknowledgement: effectiveMediaConfig.requireAcknowledgement,
      acknowledged: parsed.data.mediaAcknowledged === true,
      acknowledgementLabel: effectiveMediaConfig.acknowledgementLabel,
      blocks: effectiveMediaConfig.blocks.map((block) => ({
        id: block.id,
        type: block.type,
        title: block.title,
        body: block.body,
        url: block.url,
        sortOrder: block.sortOrder,
      })),
    };
    const languageConfig = parseInductionLanguageConfig(
      template.induction_languages,
    );
    const selectedLanguageCode = resolveInductionLanguageSelection(
      languageConfig,
      parsed.data.languageCode,
    );
    const selectedLanguageVariant = getInductionLanguageVariant(
      languageConfig,
      selectedLanguageCode,
    );
    const requestedLanguageCode = normalizeLanguageCode(parsed.data.languageCode);

    if (
      requestedLanguageCode &&
      requestedLanguageCode !== selectedLanguageCode
    ) {
      return validationErrorResponse(
        {
          languageCode: [
            `Selected language "${requestedLanguageCode}" is not configured for this template.`,
          ],
        },
        "Selected language is unavailable",
      );
    }

    if (selectedLanguageCode !== languageConfig.defaultLanguage) {
      try {
        await assertCompanyFeatureEnabled(
          site.company.id,
          "MULTI_LANGUAGE",
          site.id,
        );
      } catch (error) {
        if (error instanceof EntitlementDeniedError) {
          return errorResponse(
            "FORBIDDEN",
            "Multi-language packs are not enabled for this site plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
          );
        }
        throw error;
      }
    }

    if (
      hasInductionMedia(effectiveMediaConfig) &&
      effectiveMediaConfig.requireAcknowledgement &&
      parsed.data.mediaAcknowledged !== true
    ) {
      return validationErrorResponse(
        {
          mediaAcknowledged: [
            "Please confirm you reviewed the induction material before continuing.",
          ],
        },
        "Induction media acknowledgement required",
      );
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

    if (!parsed.data.signatureData?.trim()) {
      return validationErrorResponse(
        { signatureData: ["Signature is required"] },
        "Please provide your signature before signing in",
      );
    }

    if (quizPolicy) {
      const attemptState = await findInductionQuizAttemptState(site.company.id, {
        siteId: site.id,
        templateId: template.id,
        visitorPhoneE164: formattedPhone,
      });

      if (
        attemptState?.cooldown_until &&
        attemptState.cooldown_until.getTime() > Date.now()
      ) {
        return validationErrorResponse(
          {
            answers: [
              `Quiz retry cooldown is active until ${attemptState.cooldown_until.toISOString()}.`,
            ],
          },
          "Quiz retry cooldown active",
        );
      }
    }

    let matchedPermitRequestId: string | null = null;
    if (FEATURE_FLAGS.PERMITS_V1) {
      let permitsFeatureEnabled = false;
      try {
        await assertCompanyFeatureEnabled(site.company.id, "PERMITS_V1", site.id);
        permitsFeatureEnabled = true;
      } catch (error) {
        if (!(error instanceof EntitlementDeniedError)) {
          throw error;
        }
      }

      if (permitsFeatureEnabled) {
        const requiredPermitTemplate = await findRequiredPermitTemplateForSite(
          site.company.id,
          site.id,
        );

        if (requiredPermitTemplate) {
          const activePermit = await findActivePermitForVisitor(site.company.id, {
            site_id: site.id,
            visitor_phone: formattedPhone,
            visitor_email: parsed.data.visitorEmail || undefined,
          });

          if (!activePermit) {
            await triggerHardwareAccessDecision({
              companyId: site.company.id,
              siteId: site.id,
              siteName: site.name,
              site,
              decision: "DENY",
              reason: "permit_required_missing",
              visitorName: parsed.data.visitorName,
              visitorPhoneE164: formattedPhone,
              requestId,
              log,
              metadata: {
                permitTemplateId: requiredPermitTemplate.id,
                permitTemplateName: requiredPermitTemplate.name,
              },
            });

            return validationErrorResponse(
              {
                answers: [
                  `Active permit required before site entry (${requiredPermitTemplate.name}). Please contact your supervisor.`,
                ],
              },
              "Permit approval required before sign-in",
            );
          }

          matchedPermitRequestId = activePermit.id;
        }
      }
    }

    let visitorApprovalRequestId: string | null = null;
    if (FEATURE_FLAGS.ID_HARDENING_V1) {
      let approvalFeatureEnabled = false;
      try {
        await assertCompanyFeatureEnabled(
          site.company.id,
          "VISITOR_APPROVALS_V1",
          site.id,
        );
        await assertCompanyFeatureEnabled(site.company.id, "ID_HARDENING_V1", site.id);
        approvalFeatureEnabled = true;
      } catch (error) {
        if (!(error instanceof EntitlementDeniedError)) {
          throw error;
        }
      }

      if (approvalFeatureEnabled) {
        const approvalPolicy = await findActiveVisitorApprovalPolicy(
          site.company.id,
          site.id,
        );

        if (approvalPolicy?.is_active) {
          const latestDecision = await findLatestVisitorApprovalDecision(
            site.company.id,
            {
              site_id: site.id,
              visitor_phone: formattedPhone,
              visitor_email: parsed.data.visitorEmail || undefined,
            },
          );

          if (latestDecision?.status === "DENIED") {
            await triggerHardwareAccessDecision({
              companyId: site.company.id,
              siteId: site.id,
              siteName: site.name,
              site,
              decision: "DENY",
              reason: "visitor_approval_denied",
              visitorName: parsed.data.visitorName,
              visitorPhoneE164: formattedPhone,
              requestId,
              log,
              metadata: {
                approvalRequestId: latestDecision.id,
              },
            });

            return validationErrorResponse(
              {
                answers: [
                  "A previous visitor approval decision denied entry for this visitor. Please contact reception.",
                ],
              },
              "Visitor approval denied",
            );
          }

          if (!latestDecision || latestDecision.status !== "APPROVED") {
            const watchlistMatch = approvalPolicy.require_watchlist_screening
              ? await matchVisitorAgainstWatchlist(site.company.id, {
                  full_name: parsed.data.visitorName,
                  phone: formattedPhone,
                  email: parsed.data.visitorEmail || undefined,
                })
              : { matched: false, reasons: [] as string[] };

            const randomCheck = shouldTriggerRandomCheck(
              `${site.id}:${idempotencyKey}:${formattedPhone}`,
              approvalPolicy.random_check_percentage,
            );

            let riskTrigger = false;
            let riskContext:
              | {
                  contractor_id: string;
                  threshold_state: string;
                  current_score: number;
                }
              | null = null;
            if (FEATURE_FLAGS.RISK_PASSPORT_V1 && parsed.data.visitorEmail?.trim()) {
              try {
                await assertCompanyFeatureEnabled(
                  site.company.id,
                  "RISK_PASSPORT_V1",
                  site.id,
                );
                const contractor = await findContractorByEmail(
                  site.company.id,
                  parsed.data.visitorEmail.trim(),
                );
                if (contractor) {
                  const riskScore = await findContractorRiskScore(site.company.id, {
                    contractor_id: contractor.id,
                    site_id: site.id,
                  });
                  if (riskScore?.threshold_state === "HIGH") {
                    riskTrigger = true;
                    riskContext = {
                      contractor_id: contractor.id,
                      threshold_state: riskScore.threshold_state ?? "HIGH",
                      current_score: riskScore.current_score,
                    };
                  }
                }
              } catch (error) {
                if (!(error instanceof EntitlementDeniedError)) {
                  throw error;
                }
              }
            }

            if (watchlistMatch.matched || randomCheck || riskTrigger) {
              const reasons = [
                ...(watchlistMatch.matched
                  ? [`watchlist-match(${watchlistMatch.reasons.join(",")})`]
                  : []),
                ...(randomCheck ? ["random-check"] : []),
                ...(riskTrigger ? ["risk-threshold-high"] : []),
              ];

              const approvalRequest = await createVisitorApprovalRequest(
                site.company.id,
                {
                  site_id: site.id,
                  visitor_name: parsed.data.visitorName,
                  visitor_phone: formattedPhone,
                  visitor_email: parsed.data.visitorEmail || undefined,
                  employer_name: parsed.data.employerName || undefined,
                  visitor_type: parsed.data.visitorType,
                  reason: `identity-hardening:${reasons.join("|")}`,
                  policy_id: approvalPolicy.id,
                  random_check_triggered: randomCheck,
                  watchlist_match: watchlistMatch.matched,
                  watchlist_entry_id: watchlistMatch.matched_entry?.id,
                  token_seed: idempotencyKey,
                },
              );
              visitorApprovalRequestId = approvalRequest.id;

              const [ip, userAgent] = await Promise.all([
                getClientIp(),
                getUserAgent(),
              ]);
              await createAuditLog(site.company.id, {
                action: "visitor.approval_required",
                entity_type: "VisitorApprovalRequest",
                entity_id: approvalRequest.id,
                user_id: undefined,
                details: {
                  site_id: site.id,
                  visitor_name: parsed.data.visitorName,
                  visitor_phone: formattedPhone,
                  visitor_email: parsed.data.visitorEmail || null,
                  watchlist_match: watchlistMatch.matched,
                  watchlist_reasons: watchlistMatch.reasons,
                  random_check_triggered: randomCheck,
                  risk_threshold_triggered: riskTrigger,
                  risk_context: riskContext,
                  policy_id: approvalPolicy.id,
                },
                ip_address: ip,
                user_agent: userAgent,
                request_id: requestId,
              });

              try {
                const appUrl = resolveAppUrlBase();
                const channelActionUrl = appUrl
                  ? `${appUrl}/api/integrations/channels/actions`
                  : "/api/integrations/channels/actions";

                await sendChannelEventsForSite({
                  companyId: site.company.id,
                  siteId: site.id,
                  eventType: "visitor.approval.required",
                  requestId,
                  log,
                  payloadForConfig: (config) => ({
                    event_type: "visitor.approval.required",
                    site_id: site.id,
                    site_name: site.name,
                    approval_request_id: approvalRequest.id,
                    visitor_name: parsed.data.visitorName,
                    visitor_phone: formattedPhone,
                    visitor_email: parsed.data.visitorEmail || null,
                    visitor_type: parsed.data.visitorType,
                    reason: `identity-hardening:${reasons.join("|")}`,
                    policy_id: approvalPolicy.id,
                    action_url: channelActionUrl,
                    actions: [
                      {
                        label: "Approve",
                        decision: "APPROVED",
                        body: {
                          integrationConfigId: config.id,
                          actionId: `${approvalRequest.id}:${config.id}:approve:${requestId}`,
                          approvalRequestId: approvalRequest.id,
                          decision: "APPROVED",
                        },
                      },
                      {
                        label: "Deny",
                        decision: "DENIED",
                        body: {
                          integrationConfigId: config.id,
                          actionId: `${approvalRequest.id}:${config.id}:deny:${requestId}`,
                          approvalRequestId: approvalRequest.id,
                          decision: "DENIED",
                        },
                      },
                    ],
                  }),
                });
              } catch (channelError) {
                log.error(
                  {
                    requestId,
                    siteId: site.id,
                    approvalRequestId: approvalRequest.id,
                    errorType:
                      channelError instanceof Error ? channelError.name : "unknown",
                  },
                  "Failed to dispatch channel approval-required notifications",
                );
              }

              await triggerHardwareAccessDecision({
                companyId: site.company.id,
                siteId: site.id,
                siteName: site.name,
                site,
                decision: "DENY",
                reason: "visitor_approval_pending",
                visitorName: parsed.data.visitorName,
                visitorPhoneE164: formattedPhone,
                requestId,
                log,
                metadata: {
                  approvalRequestId: approvalRequest.id,
                  randomCheck,
                  watchlistMatch: watchlistMatch.matched,
                  riskThreshold: riskTrigger,
                  riskContext,
                },
              });

              return validationErrorResponse(
                {
                  answers: [
                    `Manual approval required before entry (ref ${approvalRequest.id.slice(0, 8)}).`,
                  ],
                },
                "Visitor approval required before sign-in",
              );
            }
          }
        }
      }
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

      let approvedQuizResult: QuizResultPayload | undefined;
      if (quizPolicy) {
        const quizEvaluation = await evaluateQuizAttemptAndPersist({
          companyId: site.company.id,
          siteId: site.id,
          templateId: template.id,
          templateQuestions: template.questions,
          answers: parsed.data.answers,
          visitorPhoneE164: formattedPhone,
          quizPolicy,
        });

        if (quizEvaluation.blockedReason) {
          await triggerHardwareAccessDecision({
            companyId: site.company.id,
            siteId: site.id,
            siteName: site.name,
            site,
            decision: "DENY",
            reason: "quiz_threshold_not_met",
            visitorName: parsed.data.visitorName,
            visitorPhoneE164: formattedPhone,
            requestId,
            log,
            metadata: {
              templateId: template.id,
            },
          });
          return validationErrorResponse(
            { answers: [quizEvaluation.blockedReason] },
            "Quiz pass threshold not met",
          );
        }

        approvedQuizResult = quizEvaluation.quizResult;
      }

      const approvedCompetencyEvaluation = await evaluateCompetencyForWorker(
        site.company.id,
        {
          site_id: site.id,
          visitor_phone: formattedPhone,
          visitor_email: parsed.data.visitorEmail || undefined,
          role_key: parsed.data.roleOnSite || undefined,
        },
      );
      if (approvedCompetencyEvaluation.status === "BLOCKED") {
        await recordCompetencyDecision(site.company.id, {
          site_id: site.id,
          visitor_phone: formattedPhone,
          status: approvedCompetencyEvaluation.status,
          blocked_reason: approvedCompetencyEvaluation.blockedReason,
          summary: competencyDecisionSummary(approvedCompetencyEvaluation),
        });
        await triggerHardwareAccessDecision({
          companyId: site.company.id,
          siteId: site.id,
          siteName: site.name,
          site,
          decision: "DENY",
          reason: "competency_blocked",
          visitorName: parsed.data.visitorName,
          visitorPhoneE164: formattedPhone,
          requestId,
          log,
          metadata: {
            escalationId: escalationCreated.escalation.id,
            competencyStatus: approvedCompetencyEvaluation.status,
          },
        });
        return validationErrorResponse(
          {
            answers: [
              approvedCompetencyEvaluation.blockedReason ??
                "This worker is missing a required competency or certification for this site.",
            ],
          },
          "Worker competency requirements are not met",
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
        ...(locationAudit
          ? {
              locationAudit: {
                latitude: locationAudit.latitude,
                longitude: locationAudit.longitude,
                accuracyMeters: locationAudit.accuracyMeters ?? undefined,
                distanceMeters: locationAudit.distanceMeters,
                withinSiteRadius: locationAudit.withinSiteRadius,
                capturedAt: locationAudit.capturedAt,
              },
            }
          : {}),
        competencyEvidence: {
          status: "SUPERVISOR_APPROVED",
          supervisorVerifiedBy: escalationCreated.escalation.reviewed_by,
          supervisorVerifiedAt: escalationCreated.escalation.reviewed_at,
          briefingAcknowledgedAt:
            escalationCreated.escalation.termsAcceptedAt ?? new Date(),
        },
        quizResult: approvedQuizResult,
        languageSelection: {
          code: selectedLanguageCode,
          label: selectedLanguageVariant?.label ?? null,
          usedVariant: selectedLanguageVariant !== null,
        },
        mediaEvidence,
      });
      await recordCompetencyDecision(site.company.id, {
        site_id: site.id,
        sign_in_record_id: approvedResult.signInRecordId,
        visitor_phone: formattedPhone,
        status: approvedCompetencyEvaluation.status,
        blocked_reason: approvedCompetencyEvaluation.blockedReason,
        summary: competencyDecisionSummary(approvedCompetencyEvaluation),
      });
      const approvedResponse = buildPublicSignInResponse(
        approvedResult,
        approvedCompetencyEvaluation,
      );

        const hostNotificationDelivery = await queueHostArrivalNotifications({
          companyId: site.company.id,
          siteId: site.id,
          siteName: site.name,
          visitorName: parsed.data.visitorName,
          visitorType: parsed.data.visitorType,
          signInTime: approvedResult.signInTime,
          employerName: parsed.data.employerName,
          roleOnSite: parsed.data.roleOnSite,
          selectedHostRecipientId: parsed.data.hostRecipientId,
          requestId,
          log,
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
            pre_registration_invite_id: preRegistrationInviteId,
            location_audit_enabled: locationAuditFeatureEnabled,
            location_captured: Boolean(locationAudit),
            location_within_site_radius: locationAudit?.withinSiteRadius,
            location_distance_m: locationAudit?.distanceMeters,
            location_radius_m: locationAudit?.radiusMeters,
            location_accuracy_m: locationAudit?.accuracyMeters,
            geofence_enforcement_enabled: geofenceEnforcementFeatureEnabled,
            geofence_mode: accessControlConfig.geofence.mode,
            geofence_override_used: geofenceGate.overrideUsed,
            quiz_scoring_enabled: Boolean(approvedQuizResult),
            quiz_score_percent: approvedQuizResult?.scorePercent ?? null,
            quiz_passed: approvedQuizResult?.passed ?? null,
            quiz_pass_threshold_percent:
              approvedQuizResult?.thresholdPercent ?? null,
            media_blocks_enabled: hasInductionMedia(effectiveMediaConfig),
            media_ack_required: effectiveMediaConfig.requireAcknowledgement,
            media_acknowledged: parsed.data.mediaAcknowledged === true,
            selected_language_code: selectedLanguageCode,
            selected_language_label: selectedLanguageVariant?.label ?? null,
            selected_language_variant: selectedLanguageVariant !== null,
            competency_status: approvedCompetencyEvaluation.status,
            competency_requirement_count:
              approvedCompetencyEvaluation.requirementCount,
            competency_missing_count: approvedCompetencyEvaluation.missingCount,
            competency_expiring_count:
              approvedCompetencyEvaluation.expiringCount,
            competency_blocked_reason:
              approvedCompetencyEvaluation.blockedReason,
            host_recipient_id: parsed.data.hostRecipientId ?? null,
            host_notifications_enabled:
              hostNotificationDelivery.featureEnabled,
            host_notification_targets: hostNotificationDelivery.targets,
            host_notifications_queued: hostNotificationDelivery.queued,
            permit_request_id: matchedPermitRequestId,
            visitor_approval_request_id: visitorApprovalRequestId,
          },
          ip_address: ip,
          user_agent: userAgent,
          request_id: requestId,
        });

        await markInviteUsedIfNeeded({
          companyId: site.company.id,
          inviteId: preRegistrationInviteId,
          signInRecordId: approvedResult.signInRecordId,
          requestId,
          log,
        });

        await triggerHardwareAccessDecision({
          companyId: site.company.id,
          siteId: site.id,
          siteName: site.name,
          site,
          decision: "ALLOW",
          reason: "sign_in_success",
          signInRecordId: approvedResult.signInRecordId,
          visitorName: parsed.data.visitorName,
          visitorPhoneE164: formattedPhone,
          requestId,
          log,
          metadata: {
            escalationApproved: true,
          },
        });

        await sendVisitorSmsReceipt({
          companyId: site.company.id,
          siteId: site.id,
          siteName: site.name,
          visitorName: parsed.data.visitorName,
          visitorPhoneE164: formattedPhone,
          signOutToken: approvedResult.signOutToken,
          requestId,
          log,
        });

        try {
          await sendChannelEventsForSite({
            companyId: site.company.id,
            siteId: site.id,
            eventType: "visitor.arrival",
            requestId,
            log,
            payload: {
              event_type: "visitor.arrival",
              site_id: site.id,
              site_name: site.name,
              sign_in_record_id: approvedResult.signInRecordId,
              sign_in_time: approvedResult.signInTime.toISOString(),
              visitor_name: parsed.data.visitorName,
              visitor_phone: formattedPhone,
              visitor_email: parsed.data.visitorEmail || null,
              visitor_type: parsed.data.visitorType,
              employer_name: parsed.data.employerName || null,
              role_on_site: parsed.data.roleOnSite || null,
            },
          });
        } catch (channelError) {
          log.error(
            {
              requestId,
              siteId: site.id,
              signInRecordId: approvedResult.signInRecordId,
              errorType:
                channelError instanceof Error ? channelError.name : "unknown",
            },
            "Failed to dispatch channel arrival notifications",
          );
        }

        await triggerOutboundWebhooks({
          companyId: site.company.id,
          siteId: site.id,
          site,
          result: approvedResult,
          requestId,
          log,
        });

        await triggerLmsCompletionSync({
          companyId: site.company.id,
          siteId: site.id,
          site,
          result: approvedResult,
          requestId,
          log,
        });

        return successResponse(approvedResponse, "Signed in successfully");
      }

      if (
        !escalationCreated.created &&
        escalationCreated.escalation.status === "DENIED"
      ) {
        await triggerHardwareAccessDecision({
          companyId: site.company.id,
          siteId: site.id,
          siteName: site.name,
          site,
          decision: "DENY",
          reason: "supervisor_denied",
          visitorName: parsed.data.visitorName,
          visitorPhoneE164: formattedPhone,
          requestId,
          log,
          metadata: {
            escalationId: escalationCreated.escalation.id,
          },
        });
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
            selected_language_code: selectedLanguageCode,
            selected_language_label: selectedLanguageVariant?.label ?? null,
            selected_language_variant: selectedLanguageVariant !== null,
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

      await triggerHardwareAccessDecision({
        companyId: site.company.id,
        siteId: site.id,
        siteName: site.name,
        site,
        decision: "DENY",
        reason: "escalation_pending",
        visitorName: parsed.data.visitorName,
        visitorPhoneE164: formattedPhone,
        requestId,
        log,
        metadata: {
          escalationId: escalationCreated.escalation.id,
        },
      });

      return validationErrorResponse(
        {
          answers: [
            `Critical safety response detected. Supervisor review required (ref ${escalationCreated.escalation.id.slice(0, 8)}).`,
          ],
        },
        "Supervisor approval required before sign-in",
      );
    }

    let quizResult: QuizResultPayload | undefined;
    if (quizPolicy) {
      const quizEvaluation = await evaluateQuizAttemptAndPersist({
        companyId: site.company.id,
        siteId: site.id,
        templateId: template.id,
        templateQuestions: template.questions,
        answers: parsed.data.answers,
        visitorPhoneE164: formattedPhone,
        quizPolicy,
      });

      if (quizEvaluation.blockedReason) {
        await triggerHardwareAccessDecision({
          companyId: site.company.id,
          siteId: site.id,
          siteName: site.name,
          site,
          decision: "DENY",
          reason: "quiz_threshold_not_met",
          visitorName: parsed.data.visitorName,
          visitorPhoneE164: formattedPhone,
          requestId,
          log,
          metadata: {
            templateId: template.id,
          },
        });
        return validationErrorResponse(
          { answers: [quizEvaluation.blockedReason] },
          "Quiz pass threshold not met",
        );
      }

      quizResult = quizEvaluation.quizResult;
    }

    const competencyEvaluation = await evaluateCompetencyForWorker(
      site.company.id,
      {
        site_id: site.id,
        visitor_phone: formattedPhone,
        visitor_email: parsed.data.visitorEmail || undefined,
        role_key: parsed.data.roleOnSite || undefined,
      },
    );
    if (competencyEvaluation.status === "BLOCKED") {
      await recordCompetencyDecision(site.company.id, {
        site_id: site.id,
        visitor_phone: formattedPhone,
        status: competencyEvaluation.status,
        blocked_reason: competencyEvaluation.blockedReason,
        summary: competencyDecisionSummary(competencyEvaluation),
      });
      await triggerHardwareAccessDecision({
        companyId: site.company.id,
        siteId: site.id,
        siteName: site.name,
        site,
        decision: "DENY",
        reason: "competency_blocked",
        visitorName: parsed.data.visitorName,
        visitorPhoneE164: formattedPhone,
        requestId,
        log,
        metadata: {
          competencyStatus: competencyEvaluation.status,
        },
      });
      return validationErrorResponse(
        {
          answers: [
            competencyEvaluation.blockedReason ??
              "This worker is missing a required competency or certification for this site.",
          ],
        },
        "Worker competency requirements are not met",
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
      ...(locationAudit
        ? {
            locationAudit: {
              latitude: locationAudit.latitude,
              longitude: locationAudit.longitude,
              accuracyMeters: locationAudit.accuracyMeters ?? undefined,
              distanceMeters: locationAudit.distanceMeters,
              withinSiteRadius: locationAudit.withinSiteRadius,
              capturedAt: locationAudit.capturedAt,
            },
          }
        : {}),
      competencyEvidence: {
        status: "SELF_DECLARED",
        briefingAcknowledgedAt: new Date(),
      },
      quizResult,
      languageSelection: {
        code: selectedLanguageCode,
        label: selectedLanguageVariant?.label ?? null,
        usedVariant: selectedLanguageVariant !== null,
      },
      mediaEvidence,
      identityEvidence,
    });
    await recordCompetencyDecision(site.company.id, {
      site_id: site.id,
      sign_in_record_id: result.signInRecordId,
      visitor_phone: formattedPhone,
      status: competencyEvaluation.status,
      blocked_reason: competencyEvaluation.blockedReason,
      summary: competencyDecisionSummary(competencyEvaluation),
    });
    const responseResult = buildPublicSignInResponse(result, competencyEvaluation);

    const hostNotificationDelivery = await queueHostArrivalNotifications({
      companyId: site.company.id,
      siteId: site.id,
      siteName: site.name,
      visitorName: parsed.data.visitorName,
      visitorType: parsed.data.visitorType,
      signInTime: result.signInTime,
      employerName: parsed.data.employerName,
      roleOnSite: parsed.data.roleOnSite,
      selectedHostRecipientId: parsed.data.hostRecipientId,
      requestId,
      log,
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
        pre_registration_invite_id: preRegistrationInviteId,
        location_audit_enabled: locationAuditFeatureEnabled,
        location_captured: Boolean(locationAudit),
        location_within_site_radius: locationAudit?.withinSiteRadius,
        location_distance_m: locationAudit?.distanceMeters,
        location_radius_m: locationAudit?.radiusMeters,
        location_accuracy_m: locationAudit?.accuracyMeters,
        geofence_enforcement_enabled: geofenceEnforcementFeatureEnabled,
        geofence_mode: accessControlConfig.geofence.mode,
        geofence_override_used: geofenceGate.overrideUsed,
        quiz_scoring_enabled: Boolean(quizResult),
        quiz_score_percent: quizResult?.scorePercent ?? null,
        quiz_passed: quizResult?.passed ?? null,
        quiz_pass_threshold_percent: quizResult?.thresholdPercent ?? null,
        media_blocks_enabled: hasInductionMedia(effectiveMediaConfig),
        media_ack_required: effectiveMediaConfig.requireAcknowledgement,
        media_acknowledged: parsed.data.mediaAcknowledged === true,
        identity_evidence_enabled: identityEvidenceEnabled,
        identity_photo_required: identityPhotoRequired,
        identity_id_required: identityIdScanRequired,
        identity_consent_required: identityConsentRequired,
        identity_photo_supplied: Boolean(parsed.data.visitorPhotoDataUrl),
        identity_id_supplied: Boolean(parsed.data.visitorIdDataUrl),
        identity_id_type: parsed.data.visitorIdType ?? null,
        identity_ocr_required: identityOcrRequired,
        identity_ocr_executed: identityOcrExecuted,
        identity_ocr_decision_status: identityOcrDecisionStatus,
        identity_ocr_reason_code: identityOcrReasonCode,
        identity_ocr_decision_mode: accessControlConfig.identity.ocrDecisionMode,
        selected_language_code: selectedLanguageCode,
        selected_language_label: selectedLanguageVariant?.label ?? null,
        selected_language_variant: selectedLanguageVariant !== null,
        competency_status: competencyEvaluation.status,
        competency_requirement_count: competencyEvaluation.requirementCount,
        competency_missing_count: competencyEvaluation.missingCount,
        competency_expiring_count: competencyEvaluation.expiringCount,
        competency_blocked_reason: competencyEvaluation.blockedReason,
        host_recipient_id: parsed.data.hostRecipientId ?? null,
        host_notifications_enabled: hostNotificationDelivery.featureEnabled,
        host_notification_targets: hostNotificationDelivery.targets,
        host_notifications_queued: hostNotificationDelivery.queued,
        permit_request_id: matchedPermitRequestId,
        visitor_approval_request_id: visitorApprovalRequestId,
      },
      ip_address: ip,
      user_agent: userAgent,
      request_id: requestId,
    });

    await markInviteUsedIfNeeded({
      companyId: site.company.id,
      inviteId: preRegistrationInviteId,
      signInRecordId: result.signInRecordId,
      requestId,
      log,
    });

    await triggerHardwareAccessDecision({
      companyId: site.company.id,
      siteId: site.id,
      siteName: site.name,
      site,
      decision: "ALLOW",
      reason: "sign_in_success",
      signInRecordId: result.signInRecordId,
      visitorName: parsed.data.visitorName,
      visitorPhoneE164: formattedPhone,
      requestId,
      log,
      metadata: {
        escalationApproved: false,
      },
    });

    await sendVisitorSmsReceipt({
      companyId: site.company.id,
      siteId: site.id,
      siteName: site.name,
      visitorName: parsed.data.visitorName,
      visitorPhoneE164: formattedPhone,
      signOutToken: result.signOutToken,
      requestId,
      log,
    });

    try {
      await sendChannelEventsForSite({
        companyId: site.company.id,
        siteId: site.id,
        eventType: "visitor.arrival",
        requestId,
        log,
        payload: {
          event_type: "visitor.arrival",
          site_id: site.id,
          site_name: site.name,
          sign_in_record_id: result.signInRecordId,
          sign_in_time: result.signInTime.toISOString(),
          visitor_name: parsed.data.visitorName,
          visitor_phone: formattedPhone,
          visitor_email: parsed.data.visitorEmail || null,
          visitor_type: parsed.data.visitorType,
          employer_name: parsed.data.employerName || null,
          role_on_site: parsed.data.roleOnSite || null,
        },
      });
    } catch (channelError) {
      log.error(
        {
          requestId,
          siteId: site.id,
          signInRecordId: result.signInRecordId,
          errorType: channelError instanceof Error ? channelError.name : "unknown",
        },
        "Failed to dispatch channel arrival notifications",
      );
    }

    log.info(
      {
        signInRecordId: result.signInRecordId,
        siteId: site.id,
        visitorType: parsed.data.visitorType,
      },
      "Visitor signed in",
    );

    await triggerOutboundWebhooks({
      companyId: site.company.id,
      siteId: site.id,
      site,
      result,
      requestId,
      log,
    });

    await triggerLmsCompletionSync({
      companyId: site.company.id,
      siteId: site.id,
      site,
      result,
      requestId,
      log,
    });

    return successResponse(responseResult, "Signed in successfully");
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
 * Record badge print actions for the public sign-in flow.
 */
export async function submitBadgePrintAudit(
  input: { slug: string; signInRecordId: string },
): Promise<ApiResponse<{ recorded: true }>> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    await assertOrigin();
  } catch {
    return errorResponse("FORBIDDEN", "Invalid request origin");
  }

  const parsed = badgePrintAuditSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    parsed.error.issues.forEach((e) => {
      const field = e.path.join(".");
      fieldErrors[field] = fieldErrors[field] || [];
      fieldErrors[field].push(e.message);
    });
    return validationErrorResponse(fieldErrors, "Invalid badge print data");
  }

  try {
    const site = await findSiteByPublicSlug(parsed.data.slug);
    if (!site) {
      return errorResponse("NOT_FOUND", "Site not found");
    }

    try {
      await assertCompanyFeatureEnabled(
        site.company.id,
        "BADGE_PRINTING",
        site.id,
      );
    } catch (error) {
      if (error instanceof EntitlementDeniedError) {
        return errorResponse(
          "FORBIDDEN",
          "Badge printing is not enabled for this site plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
        );
      }
      throw error;
    }

    const signInRecord = await findSignInById(
      site.company.id,
      parsed.data.signInRecordId,
    );
    if (!signInRecord || signInRecord.site_id !== site.id) {
      return errorResponse("NOT_FOUND", "Sign-in record not found");
    }

    const [ip, userAgent] = await Promise.all([getClientIp(), getUserAgent()]);
    await createAuditLog(site.company.id, {
      action: "visitor.badge_print",
      entity_type: "SignInRecord",
      entity_id: signInRecord.id,
      user_id: undefined,
      details: {
        site_id: site.id,
        site_name: site.name,
        sign_in_record_id: signInRecord.id,
        print_method: "browser",
      },
      ip_address: ip,
      user_agent: userAgent,
      request_id: requestId,
    });

    return successResponse({ recorded: true }, "Badge print recorded");
  } catch (error) {
    log.error(
      {
        requestId,
        slug: parsed.data.slug,
        signInRecordId: parsed.data.signInRecordId,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to record badge print audit event",
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
    parsed.error.issues.forEach((e) => {
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
