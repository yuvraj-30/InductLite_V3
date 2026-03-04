import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  EntitlementDeniedError: class EntitlementDeniedError extends Error {
    featureKey: string;
    controlId: string;

    constructor(featureKey: string) {
      super(`Feature is not enabled for this tenant: ${featureKey}`);
      this.name = "EntitlementDeniedError";
      this.featureKey = featureKey;
      this.controlId = "PLAN-ENTITLEMENT-001";
    }
  },
  revalidatePath: vi.fn(),
  assertOrigin: vi.fn(),
  checkSitePermission: vi.fn(),
  requireAuthenticatedContextReadOnly: vi.fn(),
  createAuditLog: vi.fn(),
  findSiteById: vi.fn(),
  updateSite: vi.fn(),
  assertCompanyFeatureEnabled: vi.fn(),
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

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/lib/repository/site.repository", () => ({
  findSiteById: mocks.findSiteById,
  updateSite: mocks.updateSite,
}));

vi.mock("@/lib/plans", () => ({
  EntitlementDeniedError: mocks.EntitlementDeniedError,
  assertCompanyFeatureEnabled: mocks.assertCompanyFeatureEnabled,
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: mocks.generateRequestId,
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

import { updateSiteLmsConnectorAction } from "./actions";

describe("site lms connector actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.checkSitePermission.mockResolvedValue({ success: true });
    mocks.assertCompanyFeatureEnabled.mockResolvedValue({} as any);
    mocks.requireAuthenticatedContextReadOnly.mockResolvedValue({
      companyId: "company-1",
      userId: "user-1",
      role: "ADMIN",
    });
    mocks.findSiteById.mockResolvedValue({
      id: "site-1",
      lms_connector: null,
    });
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.createRequestLogger.mockReturnValue(mocks.logger);
  });

  it("updates site lms connector settings", async () => {
    const formData = new FormData();
    formData.set("enabled", "on");
    formData.set("endpointUrl", "https://lms.example.test/sync");
    formData.set("provider", "Moodle");
    formData.set("courseCode", "SITE-101");
    formData.set("authToken", "token-123456789");

    const result = await updateSiteLmsConnectorAction("site-1", null, formData);

    expect(result.success).toBe(true);
    expect(mocks.assertCompanyFeatureEnabled).toHaveBeenCalledWith(
      "company-1",
      "LMS_CONNECTOR",
      "site-1",
    );
    expect(mocks.updateSite).toHaveBeenCalledWith(
      "company-1",
      "site-1",
      expect.objectContaining({
        lms_connector: expect.objectContaining({
          enabled: true,
          endpointUrl: "https://lms.example.test/sync",
          provider: "Moodle",
          courseCode: "SITE-101",
        }),
      }),
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "site.lms_connector_update",
        entity_id: "site-1",
      }),
    );
  });

  it("returns forbidden when lms connector entitlement is disabled", async () => {
    mocks.assertCompanyFeatureEnabled.mockRejectedValue(
      new mocks.EntitlementDeniedError("LMS_CONNECTOR"),
    );

    const result = await updateSiteLmsConnectorAction(
      "site-1",
      null,
      new FormData(),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("disabled for this site plan");
    }
    expect(mocks.updateSite).not.toHaveBeenCalled();
  });

  it("validates endpoint when enabled", async () => {
    const formData = new FormData();
    formData.set("enabled", "on");
    formData.set("endpointUrl", "bad-url");

    const result = await updateSiteLmsConnectorAction("site-1", null, formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors?.endpointUrl?.[0]).toContain("valid");
    }
    expect(mocks.updateSite).not.toHaveBeenCalled();
  });
});

