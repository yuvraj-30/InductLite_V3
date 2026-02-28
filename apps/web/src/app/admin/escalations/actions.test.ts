import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  RepositoryError: class RepositoryError extends Error {
    code: string;

    constructor(message: string, code: string) {
      super(message);
      this.name = "RepositoryError";
      this.code = code;
    }
  },
  revalidatePath: vi.fn(),
  assertOrigin: vi.fn(),
  checkSitePermission: vi.fn(),
  requireAuthenticatedContextReadOnly: vi.fn(),
  findSignInEscalationById: vi.fn(),
  createPublicSignIn: vi.fn(),
  approveSignInEscalation: vi.fn(),
  denySignInEscalation: vi.fn(),
  createAuditLog: vi.fn(),
  generateRequestId: vi.fn(),
  createRequestLogger: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth", () => ({
  assertOrigin: mocks.assertOrigin,
  checkSitePermission: mocks.checkSitePermission,
}));

vi.mock("@/lib/tenant/context", () => ({
  requireAuthenticatedContextReadOnly: mocks.requireAuthenticatedContextReadOnly,
}));

vi.mock("@/lib/repository", () => ({
  RepositoryError: mocks.RepositoryError,
  findSignInEscalationById: mocks.findSignInEscalationById,
  createPublicSignIn: mocks.createPublicSignIn,
  approveSignInEscalation: mocks.approveSignInEscalation,
  denySignInEscalation: mocks.denySignInEscalation,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: mocks.generateRequestId,
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

import {
  approveSignInEscalationAction,
  denySignInEscalationAction,
} from "./actions";

function createEscalation() {
  return {
    id: "c123456789012345678901234",
    company_id: "company-1",
    site_id: "site-1",
    idempotency_key: "idem-1234567890123456",
    status: "PENDING",
    visitor_name: "Worker One",
    visitor_phone: "+64211234567",
    visitor_email: null,
    employer_name: "Acme Build",
    visitor_type: "CONTRACTOR",
    role_on_site: "Electrician",
    hasAcceptedTerms: true,
    termsAcceptedAt: new Date("2026-02-22T10:00:00Z"),
    terms_version_id: "terms-v1",
    privacy_version_id: "privacy-v1",
    consent_statement: "Consent text",
    template_id: "tmpl-1",
    template_version: 1,
    answers: [{ questionId: "q-1", answer: "yes" }],
    signature_data: "data:image/png;base64,abc123",
    red_flag_question_ids: ["q-1"],
    red_flag_questions: ["Are you medically fit today?"],
    notification_targets: 1,
    notifications_queued: 1,
    submitted_at: new Date("2026-02-22T10:00:00Z"),
    reviewed_at: null,
    reviewed_by: null,
    review_notes: null,
    approved_sign_in_record_id: null,
    created_at: new Date("2026-02-22T10:00:00Z"),
    updated_at: new Date("2026-02-22T10:00:00Z"),
  };
}

describe("admin escalation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.checkSitePermission.mockResolvedValue({ success: true });
    mocks.requireAuthenticatedContextReadOnly.mockResolvedValue({
      companyId: "company-1",
      userId: "user-1",
    });
    mocks.findSignInEscalationById.mockResolvedValue(createEscalation());
    mocks.createPublicSignIn.mockResolvedValue({
      signInRecordId: "signin-1",
      signOutToken: "token",
      signOutTokenExpiresAt: new Date("2026-02-23T10:00:00Z"),
      visitorName: "Worker One",
      siteName: "Site One",
      signInTime: new Date("2026-02-22T10:05:00Z"),
    });
    mocks.approveSignInEscalation.mockResolvedValue({
      ...createEscalation(),
      status: "APPROVED",
    });
    mocks.denySignInEscalation.mockResolvedValue({
      ...createEscalation(),
      status: "DENIED",
    });
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.createRequestLogger.mockReturnValue(mocks.logger);
  });

  it("blocks approve when origin validation fails", async () => {
    mocks.assertOrigin.mockRejectedValue(new Error("Invalid request origin"));

    const formData = new FormData();
    formData.set("escalationId", "c123456789012345678901234");
    const result = await approveSignInEscalationAction(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("FORBIDDEN");
      expect(result.error.message).toBe("Invalid request origin");
    }
    expect(mocks.findSignInEscalationById).not.toHaveBeenCalled();
  });

  it("approves pending escalation and creates sign-in", async () => {
    const formData = new FormData();
    formData.set("escalationId", "c123456789012345678901234");
    formData.set("reviewNotes", "Supervisor cleared entry");

    const result = await approveSignInEscalationAction(formData);

    expect(result.success).toBe(true);
    expect(mocks.createPublicSignIn).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        siteId: "site-1",
        competencyEvidence: expect.objectContaining({
          status: "SUPERVISOR_APPROVED",
          supervisorVerifiedBy: "user-1",
          supervisorVerifiedAt: expect.any(Date),
          briefingAcknowledgedAt: expect.any(Date),
        }),
      }),
    );
    expect(mocks.approveSignInEscalation).toHaveBeenCalledWith(
      "company-1",
      "c123456789012345678901234",
      expect.objectContaining({
        reviewedBy: "user-1",
        approvedSignInRecordId: "signin-1",
      }),
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "visitor.sign_in_escalation_approved",
      }),
    );
  });

  it("denies pending escalation", async () => {
    const formData = new FormData();
    formData.set("escalationId", "c123456789012345678901234");
    formData.set("reviewNotes", "Worker must report to reception");

    const result = await denySignInEscalationAction(formData);

    expect(result.success).toBe(true);
    expect(mocks.denySignInEscalation).toHaveBeenCalledWith(
      "company-1",
      "c123456789012345678901234",
      expect.objectContaining({
        reviewedBy: "user-1",
      }),
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "visitor.sign_in_escalation_denied",
      }),
    );
  });

  it("returns permission denied when site permission fails", async () => {
    mocks.checkSitePermission.mockResolvedValue({
      success: false,
      error: "Permission denied",
    });

    const formData = new FormData();
    formData.set("escalationId", "c123456789012345678901234");
    const result = await denySignInEscalationAction(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("PERMISSION_DENIED");
    }
    expect(mocks.denySignInEscalation).not.toHaveBeenCalled();
  });

  it("returns validation error when escalation is resolved during approve race", async () => {
    mocks.approveSignInEscalation.mockRejectedValue(
      new mocks.RepositoryError("Escalation already resolved", "VALIDATION"),
    );

    const formData = new FormData();
    formData.set("escalationId", "c123456789012345678901234");
    const result = await approveSignInEscalationAction(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toBe("Escalation already resolved");
    }
  });

  it("returns not found when escalation is deleted during deny race", async () => {
    mocks.denySignInEscalation.mockRejectedValue(
      new mocks.RepositoryError("Escalation not found", "NOT_FOUND"),
    );

    const formData = new FormData();
    formData.set("escalationId", "c123456789012345678901234");
    const result = await denySignInEscalationAction(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.message).toBe("Escalation not found");
    }
  });
});
