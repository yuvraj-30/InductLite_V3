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

import { updateSiteAccessControlAction } from "./actions";

describe("site access control actions", () => {
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
      access_control: null,
    });
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.createRequestLogger.mockReturnValue(mocks.logger);
  });

  it("updates geofence and hardware config when entitlements allow", async () => {
    const formData = new FormData();
    formData.set("geofenceMode", "OVERRIDE");
    formData.set("geofenceOverrideCode", "123456");
    formData.set("hardwareEnabled", "on");
    formData.set("hardwareEndpointUrl", "https://hardware.example.test/events");
    formData.set("hardwareProvider", "SITE_GATEWAY");
    formData.set("hardwareAuthToken", "token-123456789");

    const result = await updateSiteAccessControlAction("site-1", null, formData);

    expect(result.success).toBe(true);
    expect(mocks.assertCompanyFeatureEnabled).toHaveBeenCalledWith(
      "company-1",
      "GEOFENCE_ENFORCEMENT",
      "site-1",
    );
    expect(mocks.assertCompanyFeatureEnabled).toHaveBeenCalledWith(
      "company-1",
      "HARDWARE_ACCESS",
      "site-1",
    );
    expect(mocks.updateSite).toHaveBeenCalledWith(
      "company-1",
      "site-1",
      expect.objectContaining({
        access_control: expect.objectContaining({
          geofence: expect.objectContaining({
            mode: "OVERRIDE",
          }),
          hardware: expect.objectContaining({
            enabled: true,
            provider: "SITE_GATEWAY",
          }),
        }),
      }),
    );
  });

  it("blocks geofence strict modes without entitlement", async () => {
    mocks.assertCompanyFeatureEnabled.mockRejectedValue(
      new mocks.EntitlementDeniedError("GEOFENCE_ENFORCEMENT"),
    );
    const formData = new FormData();
    formData.set("geofenceMode", "DENY");

    const result = await updateSiteAccessControlAction("site-1", null, formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Geofence enforcement is disabled");
    }
    expect(mocks.updateSite).not.toHaveBeenCalled();
  });

  it("requires hardware endpoint when hardware integration is enabled", async () => {
    const formData = new FormData();
    formData.set("hardwareEnabled", "on");

    const result = await updateSiteAccessControlAction("site-1", null, formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors?.hardwareEndpointUrl?.[0]).toContain("valid");
    }
    expect(mocks.updateSite).not.toHaveBeenCalled();
  });
});
