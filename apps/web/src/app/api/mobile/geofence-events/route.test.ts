import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isFeatureEnabled: vi.fn(),
  assertCompanyFeatureEnabled: vi.fn(),
  parseBearerToken: vi.fn(),
  verifyMobileEnrollmentToken: vi.fn(),
  findActiveDeviceSubscriptionByEndpoint: vi.fn(),
  countMobileDeviceRuntimeEventsSince: vi.fn(),
  createMobileDeviceRuntimeEvent: vi.fn(),
  findSiteById: vi.fn(),
  findAccessDecisionTraceByCorrelationId: vi.fn(),
  createAccessDecisionTrace: vi.fn(),
  createSignIn: vi.fn(),
  findSignInById: vi.fn(),
  signOutVisitor: vi.fn(),
  createPresenceHint: vi.fn(),
  createAuditLog: vi.fn(),
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
  countMobileDeviceRuntimeEventsSince: mocks.countMobileDeviceRuntimeEventsSince,
  createMobileDeviceRuntimeEvent: mocks.createMobileDeviceRuntimeEvent,
  createPresenceHint: mocks.createPresenceHint,
}));

vi.mock("@/lib/repository/site.repository", () => ({
  findSiteById: mocks.findSiteById,
}));

vi.mock("@/lib/repository/hardware-trace.repository", () => ({
  createAccessDecisionTrace: mocks.createAccessDecisionTrace,
  findAccessDecisionTraceByCorrelationId: mocks.findAccessDecisionTraceByCorrelationId,
}));

vi.mock("@/lib/repository/signin.repository", () => ({
  createSignIn: mocks.createSignIn,
  findSignInById: mocks.findSignInById,
  signOutVisitor: mocks.signOutVisitor,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

import { POST } from "./route";

describe("POST /api/mobile/geofence-events", () => {
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
      user_id: "user-1",
      endpoint: "https://push.example.test/sub/1",
      token_version: 1,
      is_active: true,
    });
    mocks.findSiteById.mockResolvedValue({
      id: "cm0000000000000000000001",
      name: "Main Site",
      is_active: true,
      access_control: {
        geofence: { automationMode: "AUTO", autoCheckoutGraceMinutes: 30 },
      },
    });
    mocks.findAccessDecisionTraceByCorrelationId.mockResolvedValue(null);
    mocks.createAccessDecisionTrace.mockResolvedValue({});
    mocks.createAuditLog.mockResolvedValue({});
    mocks.createSignIn.mockResolvedValue({ id: "signin-1" });
    mocks.countMobileDeviceRuntimeEventsSince.mockResolvedValue(0);
    mocks.createMobileDeviceRuntimeEvent.mockResolvedValue({});
  });

  it("returns 401 when bearer token is missing", async () => {
    mocks.parseBearerToken.mockReturnValue(null);

    const req = new Request("http://localhost/api/mobile/geofence-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: "event-123456", eventType: "ENTRY" }),
    });
    const response = await POST(req as any);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
  });

  it("processes auto check-in entry events", async () => {
    const req = new Request("http://localhost/api/mobile/geofence-events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token-1",
      },
      body: JSON.stringify({ eventId: "event-123456", eventType: "ENTRY" }),
    });

    const response = await POST(req as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.duplicate).toBe(false);
    expect(json.action).toBe("AUTO_CHECKIN");
    expect(json.signInRecordId).toBe("signin-1");
    expect(mocks.createSignIn).toHaveBeenCalledTimes(1);
    expect(mocks.createAccessDecisionTrace).toHaveBeenCalledTimes(1);
  });

  it("returns duplicate when event correlation already exists", async () => {
    mocks.findAccessDecisionTraceByCorrelationId.mockResolvedValue({
      id: "trace-1",
      sign_in_record_id: "signin-existing",
    });

    const req = new Request("http://localhost/api/mobile/geofence-events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token-1",
      },
      body: JSON.stringify({ eventId: "event-123456", eventType: "ENTRY" }),
    });

    const response = await POST(req as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.duplicate).toBe(true);
    expect(json.signInRecordId).toBe("signin-existing");
    expect(mocks.createSignIn).not.toHaveBeenCalled();
  });
});
