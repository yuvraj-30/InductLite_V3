/**
 * Public Sign-In/Sign-Out Actions Tests
 *
 * Tests error handling to ensure:
 * 1. Raw error messages are never leaked to public responses
 * 2. Logging includes requestId and slug but never PII
 * 3. Generic error messages are returned for all error types
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

const entitlementDeniedError = vi.hoisted(
  () =>
    class EntitlementDeniedError extends Error {
      featureKey: string;
      controlId: string;

      constructor(featureKey: string) {
        super(`Feature is not enabled for this tenant: ${featureKey}`);
        this.name = "EntitlementDeniedError";
        this.featureKey = featureKey;
        this.controlId = "PLAN-ENTITLEMENT-001";
      }
    },
);

// Mock all dependencies before importing the module under test
vi.mock("@/lib/repository/site.repository", () => ({
  findSiteByPublicSlug: vi.fn(),
  listSiteManagerNotificationRecipients: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/repository/template.repository", () => ({
  getActiveTemplateForSite: vi.fn(),
}));

vi.mock("@/lib/repository/public-signin.repository", () => ({
  createPublicSignIn: vi.fn(),
  signOutWithToken: vi.fn(),
}));

vi.mock("@/lib/repository/competency.repository", () => ({
  evaluateCompetencyForWorker: vi.fn(),
  recordCompetencyDecision: vi.fn(),
}));

vi.mock("@/lib/repository/signin.repository", () => ({
  findSignInById: vi.fn(),
}));

vi.mock("@/lib/repository/pre-registration.repository", () => ({
  findActivePreRegistrationInviteByToken: vi.fn().mockResolvedValue(null),
  markPreRegistrationInviteUsed: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/repository/induction-quiz-attempt.repository", () => ({
  findInductionQuizAttemptState: vi.fn().mockResolvedValue(null),
  upsertInductionQuizAttemptState: vi.fn().mockResolvedValue({
    id: "quiz-attempt-1",
    company_id: "company-123",
    site_id: "site-123",
    template_id: "template-123",
    visitor_phone_hash: "hash",
    failed_attempts: 0,
    cooldown_until: null,
    last_attempt_at: new Date("2026-02-22T10:00:00Z"),
    last_score_percent: 100,
    last_passed: true,
    created_at: new Date("2026-02-22T10:00:00Z"),
    updated_at: new Date("2026-02-22T10:00:00Z"),
  }),
}));

vi.mock("@/lib/repository/webhook-delivery.repository", () => ({
  queueOutboundWebhookDeliveries: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/hardware/adapter", () => ({
  queueHardwareAccessDecision: vi
    .fn()
    .mockResolvedValue({ queued: false, reason: "disabled" }),
}));

vi.mock("@/lib/sms/wrapper", () => ({
  sendSmsWithQuota: vi.fn().mockResolvedValue({ status: "DISABLED" }),
}));

vi.mock("@/lib/repository/email.repository", () => ({
  queueEmailNotification: vi.fn().mockResolvedValue({ id: "notif-1" }),
}));

vi.mock("@/lib/repository/signin-escalation.repository", () => ({
  createPendingSignInEscalation: vi.fn().mockResolvedValue({
    created: true,
    escalation: {
      id: "esc-12345678",
      notification_targets: 0,
      notifications_queued: 0,
      status: "PENDING",
    },
  }),
  setSignInEscalationNotificationCounts: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/repository/emergency.repository", () => ({
  listSiteEmergencyContacts: vi.fn().mockResolvedValue([]),
  listSiteEmergencyProcedures: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/legal/consent-versioning", () => ({
  getOrCreateActiveLegalVersions: vi.fn().mockResolvedValue({
    terms: { id: "terms-v1", version: 1 },
    privacy: { id: "privacy-v1", version: 1 },
  }),
  buildConsentStatement: vi
    .fn()
    .mockReturnValue("I acknowledge the site safety terms and privacy notice."),
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkPublicSlugRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkSignInRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkSignOutRateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertOrigin: vi.fn().mockResolvedValue(undefined),
  generateRequestId: vi.fn().mockReturnValue("test-request-id-123"),
  getClientIp: vi.fn().mockResolvedValue("127.0.0.1"),
  getUserAgent: vi.fn().mockResolvedValue("test-agent"),
}));

vi.mock("@/lib/plans", () => ({
  EntitlementDeniedError: entitlementDeniedError,
  assertCompanyFeatureEnabled: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocks are set up
import {
  submitSignIn,
  submitSignOut,
  getSiteForSignIn,
  submitBadgePrintAudit,
} from "./actions";
import {
  findSiteByPublicSlug,
  listSiteManagerNotificationRecipients,
} from "@/lib/repository/site.repository";
import { findSignInById } from "@/lib/repository/signin.repository";
import {
  findActivePreRegistrationInviteByToken,
  markPreRegistrationInviteUsed,
} from "@/lib/repository/pre-registration.repository";
import {
  findInductionQuizAttemptState,
  upsertInductionQuizAttemptState,
} from "@/lib/repository/induction-quiz-attempt.repository";
import { getActiveTemplateForSite } from "@/lib/repository/template.repository";
import {
  createPublicSignIn,
  signOutWithToken,
} from "@/lib/repository/public-signin.repository";
import {
  evaluateCompetencyForWorker,
  recordCompetencyDecision,
} from "@/lib/repository/competency.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { queueEmailNotification } from "@/lib/repository/email.repository";
import {
  createPendingSignInEscalation,
  setSignInEscalationNotificationCounts,
} from "@/lib/repository/signin-escalation.repository";
import { queueOutboundWebhookDeliveries } from "@/lib/repository/webhook-delivery.repository";
import { sendSmsWithQuota } from "@/lib/sms/wrapper";
import { createRequestLogger } from "@/lib/logger";
import { assertCompanyFeatureEnabled } from "@/lib/plans";

describe("Public Actions Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (listSiteManagerNotificationRecipients as Mock).mockResolvedValue([]);
    (assertCompanyFeatureEnabled as Mock).mockResolvedValue(undefined);
    (findActivePreRegistrationInviteByToken as Mock).mockResolvedValue(null);
    (markPreRegistrationInviteUsed as Mock).mockResolvedValue(true);
    (findInductionQuizAttemptState as Mock).mockResolvedValue(null);
    (upsertInductionQuizAttemptState as Mock).mockResolvedValue({
      id: "quiz-attempt-1",
      company_id: "company-123",
      site_id: "site-123",
      template_id: "template-123",
      visitor_phone_hash: "hash",
      failed_attempts: 0,
      cooldown_until: null,
      last_attempt_at: new Date("2026-02-22T10:00:00Z"),
      last_score_percent: 100,
      last_passed: true,
      created_at: new Date("2026-02-22T10:00:00Z"),
      updated_at: new Date("2026-02-22T10:00:00Z"),
    });
    (evaluateCompetencyForWorker as Mock).mockResolvedValue({
      status: "CLEAR",
      blockedReason: null,
      requirements: [],
      requirementCount: 0,
      missingCount: 0,
      expiringCount: 0,
    });
    (recordCompetencyDecision as Mock).mockResolvedValue({
      id: "decision-1",
      company_id: "company-123",
      site_id: "site-123",
      sign_in_record_id: "signin-1",
      visitor_phone: "+64211234567",
      status: "CLEAR",
      blocked_reason: null,
      summary: null,
      decided_at: new Date("2026-02-22T10:00:00Z"),
      created_at: new Date("2026-02-22T10:00:00Z"),
      updated_at: new Date("2026-02-22T10:00:00Z"),
    });
  });

  // ============================================================================
  // safePublicErrorMessage Tests via submitSignIn
  // ============================================================================

  describe("submitSignIn error handling", () => {
    const validInput = {
      slug: "test-site",
      visitorName: "John Doe",
      visitorPhone: "+64211234567",
      visitorType: "CONTRACTOR" as const,
      hasAcceptedTerms: true,
      answers: [],
      signatureData:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBgJ0nYwAAAABJRU5ErkJggg==",
    };

    const mockSite = {
      id: "site-123",
      name: "Test Site",
      address: "123 Test St",
      description: null,
      location_latitude: null,
      location_longitude: null,
      location_radius_m: null,
      company: { id: "company-123", name: "Test Company" },
    };

    const mockTemplate = {
      id: "template-123",
      name: "Test Template",
      description: null,
      version: 1,
      induction_languages: null,
      questions: [],
    };

    it("should return generic error when repository throws Error with sensitive message", async () => {
      // Arrange: Mock repository to throw an error with sensitive database info
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
      (createPublicSignIn as Mock).mockRejectedValue(
        new Error(
          "FATAL: connection to server at 'db.internal.company.com' failed: Connection refused",
        ),
      );

      // Act
      const result = await submitSignIn(validInput);

      // Assert: Response should NOT contain the raw error message
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).not.toContain("db.internal.company.com");
        expect(result.error.message).not.toContain("FATAL");
        expect(result.error.message).not.toContain("Connection refused");
        expect(result.error.message).toBe(
          "An unexpected error occurred. Please try again.",
        );
      }
    });

    it("should return validation error when terms are not accepted", async () => {
      const result = await submitSignIn({
        ...validInput,
        hasAcceptedTerms: false,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("blocks sign-in when competency requirements are not met", async () => {
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
      (evaluateCompetencyForWorker as Mock).mockResolvedValue({
        status: "BLOCKED",
        blockedReason: "Forklift certification: No certification recorded for this requirement.",
        requirements: [],
        requirementCount: 1,
        missingCount: 1,
        expiringCount: 0,
      });

      const result = await submitSignIn(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toBe("Worker competency requirements are not met");
      }
      expect(createPublicSignIn).not.toHaveBeenCalled();
      expect(recordCompetencyDecision).toHaveBeenCalledWith(
        "company-123",
        expect.objectContaining({
          site_id: "site-123",
          status: "BLOCKED",
        }),
      );
    });

    it("requires media acknowledgement when template media is configured", async () => {
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue({
        ...mockTemplate,
        induction_media: {
          version: 1,
          requireAcknowledgement: true,
          acknowledgementLabel:
            "I have reviewed the induction material before continuing.",
          blocks: [
            {
              id: "media-1",
              type: "PDF",
              title: "Site Safety PDF",
              url: "https://example.com/safety.pdf",
              sortOrder: 1,
            },
          ],
        },
      });

      const result = await submitSignIn(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toBe(
          "Induction media acknowledgement required",
        );
      }
      expect(createPublicSignIn).not.toHaveBeenCalled();
    });

    it("skips media acknowledgement when content-block entitlement is disabled", async () => {
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue({
        ...mockTemplate,
        induction_media: {
          version: 1,
          requireAcknowledgement: true,
          acknowledgementLabel:
            "I have reviewed the induction material before continuing.",
          blocks: [
            {
              id: "media-1",
              type: "PDF",
              title: "Site Safety PDF",
              url: "https://example.com/safety.pdf",
              sortOrder: 1,
            },
          ],
        },
      });
      (assertCompanyFeatureEnabled as Mock).mockImplementation(
        async (_companyId: string, featureKey: string) => {
          if (featureKey === "CONTENT_BLOCKS") {
            throw new entitlementDeniedError("CONTENT_BLOCKS");
          }
          return undefined;
        },
      );
      (createPublicSignIn as Mock).mockResolvedValue({
        signInRecordId: "signin-1",
        signOutToken: "token-1",
        signOutTokenExpiresAt: new Date("2026-02-23T10:00:00Z"),
        visitorName: "John Doe",
        siteName: "Test Site",
        signInTime: new Date("2026-02-22T10:00:00Z"),
      });

      const result = await submitSignIn(validInput);

      expect(result.success).toBe(true);
      expect(createPublicSignIn).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaEvidence: expect.objectContaining({
            enabled: false,
          }),
        }),
      );
    });

    it("persists media evidence in completion payload when media is configured", async () => {
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue({
        ...mockTemplate,
        induction_media: {
          version: 1,
          requireAcknowledgement: true,
          acknowledgementLabel:
            "I have reviewed the induction material before continuing.",
          blocks: [
            {
              id: "media-1",
              type: "TEXT",
              title: "Safety Notes",
              body: "Read this before entering.",
              sortOrder: 1,
            },
          ],
        },
      });
      (createPublicSignIn as Mock).mockResolvedValue({
        signInRecordId: "signin-1",
        signOutToken: "token-1",
        signOutTokenExpiresAt: new Date("2026-02-23T10:00:00Z"),
        visitorName: "John Doe",
        siteName: "Test Site",
        signInTime: new Date("2026-02-22T10:00:00Z"),
      });

      const result = await submitSignIn({
        ...validInput,
        mediaAcknowledged: true,
      });

      expect(result.success).toBe(true);
      expect(createPublicSignIn).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaEvidence: expect.objectContaining({
            enabled: true,
            requireAcknowledgement: true,
            acknowledged: true,
            blocks: expect.arrayContaining([
              expect.objectContaining({
                id: "media-1",
                type: "TEXT",
                title: "Safety Notes",
              }),
            ]),
          }),
        }),
      );
    });

    it("rejects unavailable language selection", async () => {
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue({
        ...mockTemplate,
        induction_languages: {
          defaultLanguage: "en",
          variants: [
            {
              languageCode: "mi",
              label: "Te Reo Maori",
              templateName: "Whakauru Pae",
            },
          ],
        },
      });

      const result = await submitSignIn({
        ...validInput,
        languageCode: "fr",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toBe("Selected language is unavailable");
      }
      expect(createPublicSignIn).not.toHaveBeenCalled();
    });

    it("enforces entitlement when non-default language is requested", async () => {
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue({
        ...mockTemplate,
        induction_languages: {
          defaultLanguage: "en",
          variants: [
            {
              languageCode: "mi",
              label: "Te Reo Maori",
              templateName: "Whakauru Pae",
            },
          ],
        },
      });
      (assertCompanyFeatureEnabled as Mock).mockImplementation(
        async (_companyId: string, featureKey: string) => {
          if (featureKey === "MULTI_LANGUAGE") {
            throw new entitlementDeniedError("MULTI_LANGUAGE");
          }
          return undefined;
        },
      );

      const result = await submitSignIn({
        ...validInput,
        languageCode: "mi",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FORBIDDEN");
        expect(result.error.message).toContain(
          "Multi-language packs are not enabled",
        );
      }
      expect(createPublicSignIn).not.toHaveBeenCalled();
    });

    it("passes selected language evidence into sign-in snapshot payload", async () => {
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue({
        ...mockTemplate,
        induction_languages: {
          defaultLanguage: "en",
          variants: [
            {
              languageCode: "mi",
              label: "Te Reo Maori",
              templateName: "Whakauru Pae",
            },
          ],
        },
      });
      (createPublicSignIn as Mock).mockResolvedValue({
        signInRecordId: "signin-1",
        signOutToken: "token-1",
        signOutTokenExpiresAt: new Date("2026-02-23T10:00:00Z"),
        visitorName: "John Doe",
        siteName: "Test Site",
        signInTime: new Date("2026-02-22T10:00:00Z"),
      });

      const result = await submitSignIn({
        ...validInput,
        languageCode: "mi",
      });

      expect(result.success).toBe(true);
      expect(createPublicSignIn).toHaveBeenCalledWith(
        expect.objectContaining({
          languageSelection: {
            code: "mi",
            label: "Te Reo Maori",
            usedVariant: true,
          },
        }),
      );
    });

    it("blocks quiz attempts while cooldown is active", async () => {
      const questionId = "c123456789012345678901234";
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue({
        ...mockTemplate,
        quiz_scoring_enabled: true,
        quiz_pass_threshold: 80,
        quiz_max_attempts: 3,
        quiz_cooldown_minutes: 30,
        quiz_required_for_entry: true,
        questions: [
          {
            id: questionId,
            question_text: "Are you wearing PPE?",
            question_type: "YES_NO",
            options: null,
            is_required: true,
            display_order: 1,
            red_flag: false,
            correct_answer: "yes",
          },
        ],
      });
      (findInductionQuizAttemptState as Mock).mockResolvedValue({
        id: "quiz-attempt-1",
        company_id: "company-123",
        site_id: "site-123",
        template_id: "template-123",
        visitor_phone_hash: "hash",
        failed_attempts: 0,
        cooldown_until: new Date(Date.now() + 60_000),
        last_attempt_at: new Date(),
        last_score_percent: 0,
        last_passed: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await submitSignIn({
        ...validInput,
        answers: [{ questionId, answer: "yes" }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("Quiz retry cooldown active");
      }
      expect(createPublicSignIn).not.toHaveBeenCalled();
    });

    it("blocks sign-in when quiz pass threshold is not met", async () => {
      const questionId = "c123456789012345678901234";
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue({
        ...mockTemplate,
        quiz_scoring_enabled: true,
        quiz_pass_threshold: 100,
        quiz_max_attempts: 2,
        quiz_cooldown_minutes: 30,
        quiz_required_for_entry: true,
        questions: [
          {
            id: questionId,
            question_text: "Are you wearing PPE?",
            question_type: "YES_NO",
            options: null,
            is_required: true,
            display_order: 1,
            red_flag: false,
            correct_answer: "yes",
          },
        ],
      });

      const result = await submitSignIn({
        ...validInput,
        answers: [{ questionId, answer: "no" }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("Quiz pass threshold not met");
      }
      expect(createPublicSignIn).not.toHaveBeenCalled();
      expect(upsertInductionQuizAttemptState).toHaveBeenCalledWith(
        "company-123",
        expect.objectContaining({
          siteId: "site-123",
          templateId: "template-123",
          failedAttempts: 1,
          lastPassed: false,
          lastScorePercent: 0,
        }),
      );
    });

    it("records and passes quiz evaluation when threshold is met", async () => {
      const questionId = "c123456789012345678901234";
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue({
        ...mockTemplate,
        quiz_scoring_enabled: true,
        quiz_pass_threshold: 80,
        quiz_max_attempts: 3,
        quiz_cooldown_minutes: 15,
        quiz_required_for_entry: true,
        questions: [
          {
            id: questionId,
            question_text: "Are you wearing PPE?",
            question_type: "YES_NO",
            options: null,
            is_required: true,
            display_order: 1,
            red_flag: false,
            correct_answer: "yes",
          },
        ],
      });
      (createPublicSignIn as Mock).mockResolvedValue({
        signInRecordId: "signin-1",
        signOutToken: "token-1",
        signOutTokenExpiresAt: new Date("2026-02-23T10:00:00Z"),
        visitorName: "John Doe",
        siteName: "Test Site",
        signInTime: new Date("2026-02-22T10:00:00Z"),
      });

      const result = await submitSignIn({
        ...validInput,
        answers: [{ questionId, answer: "yes" }],
      });

      expect(result.success).toBe(true);
      expect(upsertInductionQuizAttemptState).toHaveBeenCalledWith(
        "company-123",
        expect.objectContaining({
          failedAttempts: 0,
          lastPassed: true,
          lastScorePercent: 100,
        }),
      );
      expect(createPublicSignIn).toHaveBeenCalledWith(
        expect.objectContaining({
          quizResult: expect.objectContaining({
            passed: true,
            scorePercent: 100,
            thresholdPercent: 80,
          }),
        }),
      );
    });

    it("should block sign-in when a red-flag answer requires supervisor escalation", async () => {
      const redFlagQuestionId = "c123456789012345678901234";
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue({
        ...mockTemplate,
        questions: [
          {
            id: redFlagQuestionId,
            question_text: "Do you feel unwell today?",
            question_type: "YES_NO",
            options: null,
            is_required: true,
            display_order: 1,
            red_flag: true,
          },
        ],
      });
      (listSiteManagerNotificationRecipients as Mock).mockResolvedValue([
        {
          userId: "manager-1",
          email: "manager@example.com",
          name: "Manager One",
        },
      ]);

      const result = await submitSignIn({
        ...validInput,
        answers: [{ questionId: redFlagQuestionId, answer: "yes" }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toBe(
          "Supervisor approval required before sign-in",
        );
        expect(result.error.fieldErrors?.answers?.[0]).toContain(
          "Critical safety response detected",
        );
      }
      expect(createPublicSignIn).not.toHaveBeenCalled();
      expect(createPendingSignInEscalation).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: "company-123",
          siteId: "site-123",
          visitorType: "CONTRACTOR",
        }),
      );
      expect(createAuditLog).toHaveBeenCalledWith(
        "company-123",
        expect.objectContaining({
          action: "visitor.sign_in_escalation_submitted",
          entity_type: "PendingSignInEscalation",
          entity_id: "esc-12345678",
          details: expect.objectContaining({
            manager_notification_targets: 1,
            manager_notifications_queued: 1,
          }),
        }),
      );
      expect(setSignInEscalationNotificationCounts).toHaveBeenCalledWith(
        "company-123",
        "esc-12345678",
        1,
        1,
      );
      expect(queueEmailNotification).toHaveBeenCalledWith(
        "company-123",
        expect.objectContaining({
          user_id: "manager-1",
          to: "manager@example.com",
        }),
      );
    });

    it("should complete sign-in when escalation is already approved", async () => {
      const redFlagQuestionId = "c123456789012345678901234";
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue({
        ...mockTemplate,
        questions: [
          {
            id: redFlagQuestionId,
            question_text: "Do you feel unwell today?",
            question_type: "YES_NO",
            options: null,
            is_required: true,
            display_order: 1,
            red_flag: true,
          },
        ],
      });
      (createPendingSignInEscalation as Mock).mockResolvedValue({
        created: false,
        escalation: {
          id: "esc-12345678",
          status: "APPROVED",
          reviewed_by: "manager-1",
          reviewed_at: new Date("2026-02-22T09:00:00Z"),
          termsAcceptedAt: new Date("2026-02-22T08:59:00Z"),
          notification_targets: 1,
          notifications_queued: 1,
        },
      });
      (createPublicSignIn as Mock).mockResolvedValue({
        signInRecordId: "signin-1",
        signOutToken: "token-1",
        signOutTokenExpiresAt: new Date("2026-02-23T10:00:00Z"),
        visitorName: "John Doe",
        siteName: "Test Site",
        signInTime: new Date("2026-02-22T10:00:00Z"),
      });

      const result = await submitSignIn({
        ...validInput,
        answers: [{ questionId: redFlagQuestionId, answer: "yes" }],
      });

      expect(result.success).toBe(true);
      expect(createPublicSignIn).toHaveBeenCalledWith(
        expect.objectContaining({
          competencyEvidence: expect.objectContaining({
            status: "SUPERVISOR_APPROVED",
            supervisorVerifiedBy: "manager-1",
            supervisorVerifiedAt: expect.any(Date),
            briefingAcknowledgedAt: expect.any(Date),
          }),
        }),
      );
      expect(queueEmailNotification).not.toHaveBeenCalled();
    });

    it("should return denied state when escalation is already denied", async () => {
      const redFlagQuestionId = "c123456789012345678901234";
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue({
        ...mockTemplate,
        questions: [
          {
            id: redFlagQuestionId,
            question_text: "Do you feel unwell today?",
            question_type: "YES_NO",
            options: null,
            is_required: true,
            display_order: 1,
            red_flag: true,
          },
        ],
      });
      (createPendingSignInEscalation as Mock).mockResolvedValue({
        created: false,
        escalation: {
          id: "esc-12345678",
          status: "DENIED",
          notification_targets: 1,
          notifications_queued: 1,
        },
      });

      const result = await submitSignIn({
        ...validInput,
        answers: [{ questionId: redFlagQuestionId, answer: "yes" }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("Supervisor denied site entry");
      }
      expect(createPublicSignIn).not.toHaveBeenCalled();
    });

    it("queues host arrival notifications for successful sign-ins", async () => {
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
      (listSiteManagerNotificationRecipients as Mock).mockResolvedValue([
        {
          userId: "manager-1",
          email: "manager@example.com",
          name: "Manager One",
        },
      ]);
      (createPublicSignIn as Mock).mockResolvedValue({
        signInRecordId: "signin-1",
        signOutToken: "token-1",
        signOutTokenExpiresAt: new Date("2026-02-23T10:00:00Z"),
        visitorName: "John Doe",
        siteName: "Test Site",
        signInTime: new Date("2026-02-22T10:00:00Z"),
      });

      const result = await submitSignIn(validInput);

      expect(result.success).toBe(true);
      expect(assertCompanyFeatureEnabled).toHaveBeenCalledWith(
        "company-123",
        "HOST_NOTIFICATIONS",
        "site-123",
      );
      expect(queueEmailNotification).toHaveBeenCalledWith(
        "company-123",
        expect.objectContaining({
          user_id: "manager-1",
          to: "manager@example.com",
          subject: expect.stringContaining("Arrival"),
        }),
      );
    });

    it("does not let slow sms receipts hold the public sign-in response open", async () => {
      vi.useFakeTimers();
      try {
        (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
        (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
        (createPublicSignIn as Mock).mockResolvedValue({
          signInRecordId: "signin-1",
          signOutToken: "token-1",
          signOutTokenExpiresAt: new Date("2026-02-23T10:00:00Z"),
          visitorName: "John Doe",
          siteName: "Test Site",
          signInTime: new Date("2026-02-22T10:00:00Z"),
        });
        (sendSmsWithQuota as Mock).mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve({ status: "SENT" }), 10_000);
            }),
        );

        const resultPromise = submitSignIn(validInput);

        await vi.advanceTimersByTimeAsync(2_100);

        const result = await resultPromise;
        expect(result.success).toBe(true);
        expect(sendSmsWithQuota).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(10_000);
      } finally {
        vi.useRealTimers();
      }
    });

    it("queues host notification to selected host when hostRecipientId is provided", async () => {
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
      (listSiteManagerNotificationRecipients as Mock).mockResolvedValue([
        {
          userId: "c123456789012345678901234",
          email: "manager-1@example.com",
          name: "Manager One",
        },
        {
          userId: "c223456789012345678901234",
          email: "manager-2@example.com",
          name: "Manager Two",
        },
      ]);
      (createPublicSignIn as Mock).mockResolvedValue({
        signInRecordId: "signin-1",
        signOutToken: "token-1",
        signOutTokenExpiresAt: new Date("2026-02-23T10:00:00Z"),
        visitorName: "John Doe",
        siteName: "Test Site",
        signInTime: new Date("2026-02-22T10:00:00Z"),
      });

      const result = await submitSignIn({
        ...validInput,
        hostRecipientId: "c123456789012345678901234",
      });

      expect(result.success).toBe(true);
      expect(queueEmailNotification).toHaveBeenCalledTimes(1);
      expect(queueEmailNotification).toHaveBeenCalledWith(
        "company-123",
        expect.objectContaining({
          user_id: "c123456789012345678901234",
          to: "manager-1@example.com",
        }),
      );
    });

    it("queues outbound webhook deliveries when configured for the site", async () => {
      (findSiteByPublicSlug as Mock).mockResolvedValue({
        ...mockSite,
        webhooks: [
          "https://hooks.example.com/signins",
          { url: "https://hooks.example.com/signins" },
          { url: "invalid-url" },
        ],
      });
      (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
      (createPublicSignIn as Mock).mockResolvedValue({
        signInRecordId: "signin-1",
        signOutToken: "token-1",
        signOutTokenExpiresAt: new Date("2026-02-23T10:00:00Z"),
        visitorName: "John Doe",
        siteName: "Test Site",
        signInTime: new Date("2026-02-22T10:00:00Z"),
      });

      const result = await submitSignIn(validInput);

      expect(result.success).toBe(true);
      expect(assertCompanyFeatureEnabled).toHaveBeenCalledWith(
        "company-123",
        "WEBHOOKS_OUTBOUND",
        "site-123",
      );
      expect(queueOutboundWebhookDeliveries).toHaveBeenCalledWith(
        "company-123",
        expect.arrayContaining([
          expect.objectContaining({
            siteId: "site-123",
            eventType: "induction.completed",
            targetUrl: "https://hooks.example.com/signins",
          }),
        ]),
      );
    });

    it("queues lms completion sync delivery when lms connector is enabled", async () => {
      (findSiteByPublicSlug as Mock).mockResolvedValue({
        ...mockSite,
        lms_connector: {
          enabled: true,
          endpointUrl: "https://lms.example.test/sync",
          provider: "Moodle",
          authToken: "lms-token-123456",
          courseCode: "SITE-101",
        },
      });
      (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
      (createPublicSignIn as Mock).mockResolvedValue({
        signInRecordId: "signin-1",
        signOutToken: "token-1",
        signOutTokenExpiresAt: new Date("2026-02-23T10:00:00Z"),
        visitorName: "John Doe",
        siteName: "Test Site",
        signInTime: new Date("2026-02-22T10:00:00Z"),
      });

      const result = await submitSignIn(validInput);

      expect(result.success).toBe(true);
      expect(assertCompanyFeatureEnabled).toHaveBeenCalledWith(
        "company-123",
        "LMS_CONNECTOR",
        "site-123",
      );
      expect(queueOutboundWebhookDeliveries).toHaveBeenCalledWith(
        "company-123",
        expect.arrayContaining([
          expect.objectContaining({
            siteId: "site-123",
            eventType: "lms.completion",
            targetUrl: "https://lms.example.test/sync",
          }),
        ]),
      );
    });

    it("skips lms completion sync when lms entitlement is disabled", async () => {
      (findSiteByPublicSlug as Mock).mockResolvedValue({
        ...mockSite,
        lms_connector: {
          enabled: true,
          endpointUrl: "https://lms.example.test/sync",
          provider: "Moodle",
          authToken: "lms-token-123456",
        },
      });
      (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
      (createPublicSignIn as Mock).mockResolvedValue({
        signInRecordId: "signin-1",
        signOutToken: "token-1",
        signOutTokenExpiresAt: new Date("2026-02-23T10:00:00Z"),
        visitorName: "John Doe",
        siteName: "Test Site",
        signInTime: new Date("2026-02-22T10:00:00Z"),
      });
      (assertCompanyFeatureEnabled as Mock).mockImplementation(
        async (_companyId: string, featureKey: string) => {
          if (featureKey === "LMS_CONNECTOR") {
            throw new entitlementDeniedError("LMS_CONNECTOR");
          }
          return undefined;
        },
      );

      const result = await submitSignIn(validInput);

      expect(result.success).toBe(true);
      expect(queueOutboundWebhookDeliveries).not.toHaveBeenCalled();
    });

    it("captures location audit data and evaluates radius when enabled", async () => {
      (findSiteByPublicSlug as Mock).mockResolvedValue({
        ...mockSite,
        location_latitude: -36.8485,
        location_longitude: 174.7633,
        location_radius_m: 200,
      });
      (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
      (createPublicSignIn as Mock).mockResolvedValue({
        signInRecordId: "signin-1",
        signOutToken: "token-1",
        signOutTokenExpiresAt: new Date("2026-02-23T10:00:00Z"),
        visitorName: "John Doe",
        siteName: "Test Site",
        signInTime: new Date("2026-02-22T10:00:00Z"),
      });

      const result = await submitSignIn({
        ...validInput,
        location: {
          latitude: -36.8485,
          longitude: 174.7633,
          accuracyMeters: 20,
          capturedAt: "2026-02-28T00:00:00.000Z",
        },
      });

      expect(result.success).toBe(true);
      expect(assertCompanyFeatureEnabled).toHaveBeenCalledWith(
        "company-123",
        "LOCATION_AUDIT",
        "site-123",
      );
      const createArgs = (createPublicSignIn as Mock).mock.calls.at(-1)?.[0];
      expect(createArgs.locationAudit).toEqual(
        expect.objectContaining({
          latitude: -36.8485,
          longitude: 174.7633,
          withinSiteRadius: true,
          accuracyMeters: 20,
        }),
      );
    });

    it("skips host arrival notifications when entitlement is disabled", async () => {
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
      (listSiteManagerNotificationRecipients as Mock).mockResolvedValue([
        {
          userId: "manager-1",
          email: "manager@example.com",
          name: "Manager One",
        },
      ]);
      (assertCompanyFeatureEnabled as Mock).mockImplementation(
        async (_companyId: string, featureKey: string) => {
          if (featureKey === "HOST_NOTIFICATIONS") {
            throw new entitlementDeniedError("HOST_NOTIFICATIONS");
          }
          return undefined;
        },
      );
      (createPublicSignIn as Mock).mockResolvedValue({
        signInRecordId: "signin-1",
        signOutToken: "token-1",
        signOutTokenExpiresAt: new Date("2026-02-23T10:00:00Z"),
        visitorName: "John Doe",
        siteName: "Test Site",
        signInTime: new Date("2026-02-22T10:00:00Z"),
      });

      const result = await submitSignIn(validInput);

      expect(result.success).toBe(true);
      expect(queueEmailNotification).not.toHaveBeenCalled();
    });

    it("marks invite as used after successful sign-in when invite token is present", async () => {
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
      (findActivePreRegistrationInviteByToken as Mock).mockResolvedValue({
        id: "invite-1",
      });
      (createPublicSignIn as Mock).mockResolvedValue({
        signInRecordId: "signin-1",
        signOutToken: "token-1",
        signOutTokenExpiresAt: new Date("2026-02-23T10:00:00Z"),
        visitorName: "John Doe",
        siteName: "Test Site",
        signInTime: new Date("2026-02-22T10:00:00Z"),
      });

      const result = await submitSignIn({
        ...validInput,
        inviteToken: "invite-token-1234567890",
      });

      expect(result.success).toBe(true);
      expect(assertCompanyFeatureEnabled).toHaveBeenCalledWith(
        "company-123",
        "PREREG_INVITES",
        "site-123",
      );
      expect(markPreRegistrationInviteUsed).toHaveBeenCalledWith(
        "company-123",
        "invite-1",
        "signin-1",
      );
    });

    it("rejects invalid invite token before sign-in creation", async () => {
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
      (findActivePreRegistrationInviteByToken as Mock).mockResolvedValue(null);

      const result = await submitSignIn({
        ...validInput,
        inviteToken: "invite-token-1234567890",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toBe("Invalid invite link");
      }
      expect(createPublicSignIn).not.toHaveBeenCalled();
    });

    it("should return generic error when repository throws Error with SQL query", async () => {
      // Arrange: Simulate a Prisma error that might leak query structure
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
      (createPublicSignIn as Mock).mockRejectedValue(
        new Error(
          "Invalid `prisma.signInRecord.create()` invocation: Unique constraint failed on the fields: (`visitor_phone`)",
        ),
      );

      // Act
      const result = await submitSignIn(validInput);

      // Assert: Response should NOT contain Prisma internals
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).not.toContain("prisma");
        expect(result.error.message).not.toContain("signInRecord");
        expect(result.error.message).not.toContain("visitor_phone");
        expect(result.error.message).toBe(
          "An unexpected error occurred. Please try again.",
        );
      }
    });

    it("should return generic error when repository throws non-Error object", async () => {
      // Arrange: Some libraries throw non-Error objects
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
      (createPublicSignIn as Mock).mockRejectedValue(
        "String error with internal path /var/app/src/db.ts",
      );

      // Act
      const result = await submitSignIn(validInput);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).not.toContain("/var/app");
        expect(result.error.message).toBe(
          "An unexpected error occurred. Please try again.",
        );
      }
    });

    it("should return generic error when repository throws undefined", async () => {
      // Arrange
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
      (createPublicSignIn as Mock).mockRejectedValue(undefined);

      // Act
      const result = await submitSignIn(validInput);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe(
          "An unexpected error occurred. Please try again.",
        );
      }
    });

    it("should log error with requestId and slug but never PII", async () => {
      // Arrange
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      (createRequestLogger as Mock).mockReturnValue(mockLogger);
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
      (createPublicSignIn as Mock).mockRejectedValue(
        new Error("Database error"),
      );

      // Act
      await submitSignIn(validInput);

      // Assert: Logger should be called with structured context
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      const [logContext, logMessage] = mockLogger.error.mock.calls[0] as [
        Record<string, unknown>,
        string,
      ];

      // Should include requestId and slug
      expect(logContext).toHaveProperty("requestId");
      expect(logContext).toHaveProperty("slug", "test-site");
      expect(logContext).toHaveProperty("errorType", "Error");

      // Should NOT include PII
      expect(logContext).not.toHaveProperty("visitorName");
      expect(logContext).not.toHaveProperty("visitorPhone");
      expect(logContext).not.toHaveProperty("visitorEmail");
      expect(logContext).not.toHaveProperty("phone");
      expect(logContext).not.toHaveProperty("email");
      expect(logContext).not.toHaveProperty("name");

      // Message should be generic
      expect(logMessage).toBe("Failed to create sign-in");
    });
  });

  // ============================================================================
  // submitSignOut error handling
  // ============================================================================

  describe("submitSignOut error handling", () => {
    const validSignOutInput = {
      token: "valid-token-abc123",
      phone: "+64211234567",
    };

    it("should return generic error when signOutWithToken throws", async () => {
      // Arrange
      (signOutWithToken as Mock).mockRejectedValue(
        new Error("Redis connection failed: ECONNREFUSED 127.0.0.1:6379"),
      );

      // Act
      const result = await submitSignOut(validSignOutInput);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).not.toContain("Redis");
        expect(result.error.message).not.toContain("ECONNREFUSED");
        expect(result.error.message).not.toContain("127.0.0.1");
        expect(result.error.message).toBe(
          "An unexpected error occurred. Please try again.",
        );
      }
    });

    it("should log error with requestId but never token or phone", async () => {
      // Arrange
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      (createRequestLogger as Mock).mockReturnValue(mockLogger);
      (signOutWithToken as Mock).mockRejectedValue(new Error("DB error"));

      // Act
      await submitSignOut(validSignOutInput);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      const [logContext] = mockLogger.error.mock.calls[0] as [
        Record<string, unknown>,
      ];

      // Should include requestId
      expect(logContext).toHaveProperty("requestId");
      expect(logContext).toHaveProperty("errorType", "Error");

      // Should NOT include token or phone (PII/secrets)
      expect(logContext).not.toHaveProperty("token");
      expect(logContext).not.toHaveProperty("phone");
      expect(JSON.stringify(logContext)).not.toContain("valid-token");
      expect(JSON.stringify(logContext)).not.toContain("+64211234567");
    });
  });

  // ============================================================================
  // getSiteForSignIn entitlement behavior
  // ============================================================================

  describe("getSiteForSignIn entitlement behavior", () => {
    it("disables quiz metadata when quiz scoring entitlement is denied", async () => {
      (findSiteByPublicSlug as Mock).mockResolvedValue({
        id: "site-123",
        name: "Test Site",
        address: null,
        description: null,
        location_latitude: null,
        location_longitude: null,
        location_radius_m: null,
        company: { id: "company-123", name: "Test Company" },
      });
      (getActiveTemplateForSite as Mock).mockResolvedValue({
        id: "template-123",
        name: "Test Template",
        description: null,
        version: 1,
        induction_media: null,
        induction_languages: null,
        quiz_scoring_enabled: true,
        quiz_pass_threshold: 90,
        quiz_max_attempts: 2,
        quiz_cooldown_minutes: 30,
        quiz_required_for_entry: true,
        questions: [
          {
            id: "q-1",
            question_text: "Are you fit for work?",
            question_type: "YES_NO",
            options: null,
            is_required: true,
            red_flag: false,
            display_order: 1,
          },
        ],
      });
      (assertCompanyFeatureEnabled as Mock).mockImplementation(
        async (_companyId: string, featureKey: string) => {
          if (featureKey === "QUIZ_SCORING_V2") {
            throw new entitlementDeniedError("QUIZ_SCORING_V2");
          }
          return undefined;
        },
      );

      const result = await getSiteForSignIn("test-slug");

      expect(result.success).toBe(true);
      if (result.success && !("notFound" in result.data)) {
        expect(result.data.template.quiz?.enabled).toBe(false);
      }
      expect(assertCompanyFeatureEnabled).toHaveBeenCalledWith(
        "company-123",
        "QUIZ_SCORING_V2",
        "site-123",
      );
    });
  });

  // ============================================================================
  // getSiteForSignIn error handling
  // ============================================================================

  describe("getSiteForSignIn error handling", () => {
    it("should return generic error when findSiteByPublicSlug throws", async () => {
      // Arrange
      (findSiteByPublicSlug as Mock).mockRejectedValue(
        new Error(
          "PrismaClientKnownRequestError: Can't reach database server at `localhost:5432`",
        ),
      );

      // Act
      const result = await getSiteForSignIn("test-slug");

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).not.toContain("Prisma");
        expect(result.error.message).not.toContain("localhost");
        expect(result.error.message).not.toContain("5432");
        expect(result.error.message).toBe(
          "An unexpected error occurred. Please try again.",
        );
      }
    });

    it("should log error with requestId and slug", async () => {
      // Arrange
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      (createRequestLogger as Mock).mockReturnValue(mockLogger);
      (findSiteByPublicSlug as Mock).mockRejectedValue(new Error("timeout"));

      // Act
      await getSiteForSignIn("my-test-slug");

      // Assert
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      const [logContext] = mockLogger.error.mock.calls[0] as [
        Record<string, unknown>,
      ];

      expect(logContext).toHaveProperty("requestId");
      expect(logContext).toHaveProperty("slug", "my-test-slug");
      expect(logContext).toHaveProperty("errorType", "Error");
    });
  });

  // ============================================================================
  // Known safe error patterns
  // ============================================================================

  describe("safePublicErrorMessage known patterns", () => {
    it("should return rate limit message for rate limit errors", async () => {
      // Arrange
      (findSiteByPublicSlug as Mock).mockRejectedValue(
        new Error("Rate limit exceeded for IP"),
      );

      // Act
      const result = await getSiteForSignIn("test-slug");

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe(
          "Too many requests. Please try again later.",
        );
      }
    });

    it("should return not found message for not found errors", async () => {
      // Arrange
      const mockSite = {
        id: "site-123",
        name: "Test Site",
        address: null,
        description: null,
        company: { id: "company-123", name: "Test Company" },
      };
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockRejectedValue(
        new Error("Template not found for site"),
      );

      // Act
      const result = await getSiteForSignIn("test-slug");

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe(
          "The requested resource was not found.",
        );
      }
    });

    it("should return session expired message for token errors", async () => {
      // Arrange
      (signOutWithToken as Mock).mockRejectedValue(
        new Error("Token expired or invalid token provided"),
      );

      // Act
      const result = await submitSignOut({ token: "abc", phone: "0400000000" });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe(
          "Your session has expired. Please try again.",
        );
      }
    });
  });

  describe("submitBadgePrintAudit", () => {
    it("records badge print audit when entitlement is enabled", async () => {
      (findSiteByPublicSlug as Mock).mockResolvedValue({
        id: "site-123",
        name: "Test Site",
        address: null,
        description: null,
        company: { id: "company-123", name: "Test Company" },
      });
      (findSignInById as Mock).mockResolvedValue({
        id: "c123456789012345678901234",
        site_id: "site-123",
      });

      const result = await submitBadgePrintAudit({
        slug: "test-site",
        signInRecordId: "c123456789012345678901234",
      });

      expect(result.success).toBe(true);
      expect(assertCompanyFeatureEnabled).toHaveBeenCalledWith(
        "company-123",
        "BADGE_PRINTING",
        "site-123",
      );
      expect(createAuditLog).toHaveBeenCalledWith(
        "company-123",
        expect.objectContaining({
          action: "visitor.badge_print",
          entity_type: "SignInRecord",
          entity_id: "c123456789012345678901234",
          details: expect.objectContaining({
            print_method: "browser",
            site_id: "site-123",
          }),
        }),
      );
    });

    it("returns forbidden when badge printing entitlement is disabled", async () => {
      (findSiteByPublicSlug as Mock).mockResolvedValue({
        id: "site-123",
        name: "Test Site",
        address: null,
        description: null,
        company: { id: "company-123", name: "Test Company" },
      });
      (assertCompanyFeatureEnabled as Mock).mockRejectedValueOnce(
        new entitlementDeniedError("BADGE_PRINTING"),
      );

      const result = await submitBadgePrintAudit({
        slug: "test-site",
        signInRecordId: "c123456789012345678901234",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FORBIDDEN");
        expect(result.error.message).toContain(
          "Badge printing is not enabled for this site plan",
        );
      }
      expect(createAuditLog).not.toHaveBeenCalled();
    });
  });
});
