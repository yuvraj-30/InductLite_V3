import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  assertOrigin: vi.fn(),
  checkPermission: vi.fn(),
  checkAdminMutationRateLimit: vi.fn(),
  isFeatureEnabled: vi.fn(),
  requireAuthenticatedContextReadOnly: vi.fn(),
  assertCompanyFeatureEnabled: vi.fn(),
  findSiteById: vi.fn(),
  updateSite: vi.fn(),
  createAuditLog: vi.fn(),
  parseProcoreConnectorConfig: vi.fn(),
  buildProcoreConnectorConfig: vi.fn(),
  queueProcoreSiteSync: vi.fn(),
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
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth", () => ({
  assertOrigin: mocks.assertOrigin,
  checkPermission: mocks.checkPermission,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkAdminMutationRateLimit: mocks.checkAdminMutationRateLimit,
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: mocks.isFeatureEnabled,
}));

vi.mock("@/lib/tenant/context", () => ({
  requireAuthenticatedContextReadOnly: mocks.requireAuthenticatedContextReadOnly,
}));

vi.mock("@/lib/plans", () => ({
  EntitlementDeniedError: mocks.EntitlementDeniedError,
  assertCompanyFeatureEnabled: mocks.assertCompanyFeatureEnabled,
}));

vi.mock("@/lib/repository/site.repository", () => ({
  findSiteById: mocks.findSiteById,
  updateSite: mocks.updateSite,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/lib/integrations/procore/config", () => ({
  buildProcoreConnectorConfig: mocks.buildProcoreConnectorConfig,
  parseProcoreConnectorConfig: mocks.parseProcoreConnectorConfig,
}));

vi.mock("@/lib/integrations/procore/sync", () => ({
  queueProcoreSiteSync: mocks.queueProcoreSiteSync,
}));

import {
  queueProcoreSyncAction,
  updateProcoreConnectorAction,
} from "./actions";

describe("procore integration actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.checkPermission.mockResolvedValue({ success: true });
    mocks.checkAdminMutationRateLimit.mockResolvedValue({ success: true });
    mocks.isFeatureEnabled.mockReturnValue(true);
    mocks.requireAuthenticatedContextReadOnly.mockResolvedValue({
      companyId: "company-1",
      userId: "user-1",
    });
    mocks.assertCompanyFeatureEnabled.mockResolvedValue({});
    mocks.findSiteById.mockResolvedValue({
      id: "cm0000000000000000000001",
      lms_connector: {},
    });
    mocks.parseProcoreConnectorConfig.mockReturnValue({
      enabled: false,
      authToken: "existing-auth-token",
      inboundSharedSecret: "existing-secret",
    });
    mocks.buildProcoreConnectorConfig.mockReturnValue({
      enabled: true,
      endpointUrl: "https://procore.example.test/hook",
      authToken: "new-auth-token",
      inboundSharedSecret: "new-inbound-secret",
      includeSignInEvents: true,
      includePermitEvents: false,
      projectId: "project-1",
    });
    mocks.updateSite.mockResolvedValue({});
    mocks.createAuditLog.mockResolvedValue({});
    mocks.queueProcoreSiteSync.mockResolvedValue({
      queued: 3,
      includedSignIns: 2,
      includedPermits: 1,
    });
  });

  it("returns origin error when CSRF fails", async () => {
    mocks.assertOrigin.mockRejectedValue(new Error("Invalid request origin"));
    const result = await updateProcoreConnectorAction(null, new FormData());
    expect(result).toEqual({ success: false, error: "Invalid request origin" });
  });

  it("returns site-not-found when target site is missing", async () => {
    mocks.findSiteById.mockResolvedValue(null);
    const formData = new FormData();
    formData.set("siteId", "cm0000000000000000000001");
    formData.set("enabled", "on");
    formData.set("endpointUrl", "https://procore.example.test/hook");

    const result = await updateProcoreConnectorAction(null, formData);

    expect(result).toEqual({ success: false, error: "Site not found" });
  });

  it("updates connector settings and queues sync", async () => {
    const formData = new FormData();
    formData.set("siteId", "cm0000000000000000000001");
    formData.set("enabled", "on");
    formData.set("endpointUrl", "https://procore.example.test/hook");
    formData.set("authToken", "new-auth-token");
    formData.set("inboundSharedSecret", "new-inbound-secret");
    formData.set("projectId", "project-1");
    formData.set("includeSignInEvents", "on");

    const updateResult = await updateProcoreConnectorAction(null, formData);
    const queueResult = await queueProcoreSyncAction("cm0000000000000000000001");

    expect(updateResult).toEqual({
      success: true,
      message: "Procore connector settings saved",
    });
    expect(mocks.updateSite).toHaveBeenCalledTimes(1);
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1);
    expect(queueResult.success).toBe(true);
    if (queueResult.success) {
      expect(queueResult.message).toContain("Queued 3 connector deliveries");
    }
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/integrations/procore");
  });
});
