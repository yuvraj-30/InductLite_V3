import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class EntitlementDeniedError extends Error {
    featureKey: string;
    controlId: string;

    constructor(featureKey: string) {
      super(`Feature is not enabled for this tenant: ${featureKey}`);
      this.name = "EntitlementDeniedError";
      this.featureKey = featureKey;
      this.controlId = "PLAN-ENTITLEMENT-001";
    }
  }

  return {
    assertOrigin: vi.fn(),
    checkAdmin: vi.fn(),
    requireAuthenticatedContextReadOnly: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    findTemplateById: vi.fn(),
    createAuditLog: vi.fn(),
    createRequestLogger: vi.fn(),
    generateRequestId: vi.fn(),
    revalidatePath: vi.fn(),
    assertCompanyFeatureEnabled: vi.fn(),
    EntitlementDeniedError,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth", () => ({
  assertOrigin: mocks.assertOrigin,
  checkAdmin: mocks.checkAdmin,
}));

vi.mock("@/lib/tenant/context", () => ({
  requireAuthenticatedContextReadOnly: mocks.requireAuthenticatedContextReadOnly,
}));

vi.mock("@/lib/repository", () => ({
  findTemplateById: mocks.findTemplateById,
  findTemplateWithQuestions: vi.fn(),
  listTemplates: vi.fn(),
  createTemplate: mocks.createTemplate,
  updateTemplate: mocks.updateTemplate,
  publishTemplate: vi.fn(),
  createNewVersion: vi.fn(),
  archiveTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  unarchiveTemplate: vi.fn(),
  listQuestions: vi.fn(),
  createQuestion: vi.fn(),
  updateQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
  reorderQuestions: vi.fn(),
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: mocks.generateRequestId,
}));

vi.mock("@/lib/plans", () => ({
  EntitlementDeniedError: mocks.EntitlementDeniedError,
  assertCompanyFeatureEnabled: mocks.assertCompanyFeatureEnabled,
}));

import { createTemplateAction, updateTemplateAction } from "./actions";

describe("template actions entitlements", () => {
  const TEMPLATE_ID = "ckjld2cjxh0000qzrmn831i7rn";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.checkAdmin.mockResolvedValue({ success: true });
    mocks.requireAuthenticatedContextReadOnly.mockResolvedValue({
      companyId: "company-1",
      userId: "user-1",
    });
    mocks.createRequestLogger.mockReturnValue(mocks.logger);
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.assertCompanyFeatureEnabled.mockResolvedValue({} as any);
    mocks.createTemplate.mockResolvedValue({
      id: TEMPLATE_ID,
      name: "Template 1",
      site_id: null,
      is_default: false,
    });
    mocks.findTemplateById.mockResolvedValue({
      id: TEMPLATE_ID,
      site_id: "site-1",
    });
    mocks.updateTemplate.mockResolvedValue({
      id: TEMPLATE_ID,
      name: "Template 1",
      site_id: "site-1",
    });
  });

  it("denies template creation when quiz scoring entitlement is disabled", async () => {
    mocks.assertCompanyFeatureEnabled.mockImplementation(
      async (_companyId: string, featureKey: string) => {
        if (featureKey === "QUIZ_SCORING_V2") {
          throw new mocks.EntitlementDeniedError("QUIZ_SCORING_V2");
        }
        return {} as any;
      },
    );

    const result = await createTemplateAction({
      name: "Quiz Template",
      quiz_scoring_enabled: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("FORBIDDEN");
      expect(result.error.message).toContain("Quiz scoring");
    }
    expect(mocks.createTemplate).not.toHaveBeenCalled();
  });

  it("denies template creation when media blocks entitlement is disabled", async () => {
    mocks.assertCompanyFeatureEnabled.mockImplementation(
      async (_companyId: string, featureKey: string) => {
        if (featureKey === "CONTENT_BLOCKS") {
          throw new mocks.EntitlementDeniedError("CONTENT_BLOCKS");
        }
        return {} as any;
      },
    );

    const result = await createTemplateAction({
      name: "Media Template",
      induction_media: {
        blocks: [
          {
            type: "TEXT",
            title: "Safety briefing",
            body: "Read before continuing",
          },
        ],
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("FORBIDDEN");
      expect(result.error.message).toContain("Media-first induction blocks");
    }
    expect(mocks.createTemplate).not.toHaveBeenCalled();
  });

  it("denies template creation when multi-language entitlement is disabled", async () => {
    mocks.assertCompanyFeatureEnabled.mockImplementation(
      async (_companyId: string, featureKey: string) => {
        if (featureKey === "MULTI_LANGUAGE") {
          throw new mocks.EntitlementDeniedError("MULTI_LANGUAGE");
        }
        return {} as any;
      },
    );

    const result = await createTemplateAction({
      name: "Language Template",
      induction_languages: {
        defaultLanguage: "en",
        variants: [
          {
            languageCode: "mi",
            label: "Te Reo Maori",
            templateName: "Haumaru",
          },
        ],
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("FORBIDDEN");
      expect(result.error.message).toContain("Multi-language packs");
    }
    expect(mocks.createTemplate).not.toHaveBeenCalled();
  });

  it("enforces template update checks with existing site context", async () => {
    const result = await updateTemplateAction(TEMPLATE_ID, {
      quiz_scoring_enabled: true,
      quiz_pass_threshold: 90,
    });

    expect(result.success).toBe(true);
    expect(mocks.assertCompanyFeatureEnabled).toHaveBeenCalledWith(
      "company-1",
      "QUIZ_SCORING_V2",
      "site-1",
    );
    expect(mocks.updateTemplate).toHaveBeenCalledWith(
      "company-1",
      TEMPLATE_ID,
      expect.objectContaining({
        quiz_scoring_enabled: true,
        quiz_pass_threshold: 90,
      }),
    );
  });
});
