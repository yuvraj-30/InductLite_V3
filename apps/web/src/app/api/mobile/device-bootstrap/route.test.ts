import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isFeatureEnabled: vi.fn(),
  assertCompanyFeatureEnabled: vi.fn(),
  parseBearerToken: vi.fn(),
  verifyMobileEnrollmentToken: vi.fn(),
  findActiveDeviceSubscriptionByEndpoint: vi.fn(),
  touchDeviceSubscriptionHeartbeat: vi.fn(),
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

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: mocks.isFeatureEnabled,
}));

vi.mock("@/lib/plans", () => ({
  EntitlementDeniedError: mocks.EntitlementDeniedError,
  assertCompanyFeatureEnabled: mocks.assertCompanyFeatureEnabled,
}));

vi.mock("@/lib/mobile/enrollment-token", () => ({
  parseBearerToken: mocks.parseBearerToken,
  verifyMobileEnrollmentToken: mocks.verifyMobileEnrollmentToken,
}));

vi.mock("@/lib/repository/mobile-ops.repository", () => ({
  findActiveDeviceSubscriptionByEndpoint:
    mocks.findActiveDeviceSubscriptionByEndpoint,
  touchDeviceSubscriptionHeartbeat: mocks.touchDeviceSubscriptionHeartbeat,
  createMobileDeviceRuntimeEvent: mocks.createMobileDeviceRuntimeEvent,
}));

import { POST } from "./route";

describe("POST /api/mobile/device-bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isFeatureEnabled.mockReturnValue(true);
    mocks.assertCompanyFeatureEnabled.mockResolvedValue({});
    mocks.parseBearerToken.mockReturnValue("token-1");
    mocks.verifyMobileEnrollmentToken.mockReturnValue({
      valid: true,
      payload: {
        version: 1,
        companyId: "company-1",
        siteId: "cm0000000000000000000001",
        endpoint: "https://push.example.test/sub/1",
        deviceId: "sub-1",
        runtime: "ios-native",
        tokenVersion: 1,
        nonce: "nonce-1",
        visitorName: "Ari Contractor",
        visitorPhone: "+64211234567",
        visitorEmail: "ari@example.test",
        employerName: "Acme",
        visitorType: "EMPLOYEE",
        issuedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      },
    });
    mocks.findActiveDeviceSubscriptionByEndpoint.mockResolvedValue({
      id: "sub-1",
      site_id: "cm0000000000000000000001",
      endpoint: "https://push.example.test/sub/1",
      token_version: 1,
      is_active: true,
    });
    mocks.touchDeviceSubscriptionHeartbeat.mockResolvedValue({
      id: "sub-1",
      last_seen_at: new Date("2026-03-08T10:00:00.000Z"),
    });
    mocks.createMobileDeviceRuntimeEvent.mockResolvedValue({});
  });

  it("returns 401 when bearer token is missing", async () => {
    mocks.parseBearerToken.mockReturnValue(null);

    const req = new Request("http://localhost/api/mobile/device-bootstrap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 401 when token version no longer matches subscription", async () => {
    mocks.findActiveDeviceSubscriptionByEndpoint.mockResolvedValue({
      id: "sub-1",
      site_id: "cm0000000000000000000001",
      endpoint: "https://push.example.test/sub/1",
      token_version: 2,
      is_active: true,
    });

    const req = new Request("http://localhost/api/mobile/device-bootstrap", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token-1",
      },
      body: JSON.stringify({ platform: "ios-native" }),
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(mocks.createMobileDeviceRuntimeEvent).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        event_type: "BOOTSTRAP",
        event_status: "REJECTED",
        reason: "token_version_mismatch",
      }),
    );
  });

  it("accepts valid bootstrap request and returns runtime config", async () => {
    const req = new Request("http://localhost/api/mobile/device-bootstrap", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token-1",
      },
      body: JSON.stringify({
        platform: "ios-native",
        appVersion: "1.2.3",
        osVersion: "iOS 17",
        wrapperChannel: "app-store",
      }),
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.bootstrap.deviceId).toBe("sub-1");
    expect(mocks.touchDeviceSubscriptionHeartbeat).toHaveBeenCalledTimes(1);
    expect(mocks.createMobileDeviceRuntimeEvent).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        event_type: "BOOTSTRAP",
        event_status: "ACCEPTED",
      }),
    );
  });
});
