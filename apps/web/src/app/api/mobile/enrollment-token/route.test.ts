import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertOrigin: vi.fn(),
  isFeatureEnabled: vi.fn(),
  assertCompanyFeatureEnabled: vi.fn(),
  requireAuthenticatedContextReadOnly: vi.fn(),
  findActiveDeviceSubscriptionByEndpoint: vi.fn(),
  rotateDeviceSubscriptionTokenVersion: vi.fn(),
  generateMobileEnrollmentToken: vi.fn(),
  createAuditLog: vi.fn(),
  createMobileDeviceRuntimeEvent: vi.fn(),
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

vi.mock("@/lib/auth/csrf", () => ({
  assertOrigin: mocks.assertOrigin,
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: mocks.isFeatureEnabled,
}));

vi.mock("@/lib/plans", () => ({
  EntitlementDeniedError: mocks.EntitlementDeniedError,
  assertCompanyFeatureEnabled: mocks.assertCompanyFeatureEnabled,
}));

vi.mock("@/lib/tenant/context", () => ({
  requireAuthenticatedContextReadOnly: mocks.requireAuthenticatedContextReadOnly,
}));

vi.mock("@/lib/repository/mobile-ops.repository", () => ({
  findActiveDeviceSubscriptionByEndpoint:
    mocks.findActiveDeviceSubscriptionByEndpoint,
  rotateDeviceSubscriptionTokenVersion: mocks.rotateDeviceSubscriptionTokenVersion,
  createMobileDeviceRuntimeEvent: mocks.createMobileDeviceRuntimeEvent,
}));

vi.mock("@/lib/mobile/enrollment-token", () => ({
  generateMobileEnrollmentToken: mocks.generateMobileEnrollmentToken,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

import { POST } from "./route";

describe("POST /api/mobile/enrollment-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.isFeatureEnabled.mockReturnValue(true);
    mocks.assertCompanyFeatureEnabled.mockResolvedValue({});
    mocks.requireAuthenticatedContextReadOnly.mockResolvedValue({
      companyId: "company-1",
      userId: "user-1",
      role: "ADMIN",
    });
    mocks.findActiveDeviceSubscriptionByEndpoint.mockResolvedValue({
      id: "sub-1",
      site_id: "cm0000000000000000000001",
      endpoint: "https://push.example.test/sub/1",
      token_version: 1,
      platform: "ios-native",
      is_active: true,
    });
    mocks.rotateDeviceSubscriptionTokenVersion.mockResolvedValue({
      id: "sub-1",
      token_version: 2,
      platform: "ios-native",
    });
    mocks.generateMobileEnrollmentToken.mockReturnValue({
      token: "jwt-token-1",
      expiresAt: new Date("2026-03-08T12:00:00.000Z"),
    });
    mocks.createAuditLog.mockResolvedValue({});
    mocks.createMobileDeviceRuntimeEvent.mockResolvedValue({});
  });

  it("returns 403 when origin validation fails", async () => {
    mocks.assertOrigin.mockRejectedValue(new Error("Invalid request origin"));

    const req = new Request("http://localhost/api/mobile/enrollment-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it("returns 404 when device subscription is missing", async () => {
    mocks.findActiveDeviceSubscriptionByEndpoint.mockResolvedValue(null);

    const req = new Request("http://localhost/api/mobile/enrollment-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        endpoint: "https://push.example.test/sub/1",
        siteId: "cm0000000000000000000001",
        visitorName: "Ari Contractor",
        visitorPhone: "+64211234567",
      }),
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
  });

  it("returns enrollment token when request is valid", async () => {
    const req = new Request("http://localhost/api/mobile/enrollment-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        endpoint: "https://push.example.test/sub/1",
        siteId: "cm0000000000000000000001",
        visitorName: "Ari Contractor",
        visitorPhone: "+64211234567",
        visitorEmail: "ari@example.test",
        visitorType: "EMPLOYEE",
      }),
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.token).toBe("jwt-token-1");
    expect(mocks.rotateDeviceSubscriptionTokenVersion).toHaveBeenCalledWith(
      "company-1",
      "https://push.example.test/sub/1",
    );
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1);
    expect(mocks.createMobileDeviceRuntimeEvent).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        event_type: "ENROLLMENT",
        event_status: "ACCEPTED",
      }),
    );
  });
});
