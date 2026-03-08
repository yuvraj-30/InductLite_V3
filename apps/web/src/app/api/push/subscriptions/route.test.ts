import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertOrigin: vi.fn(),
  isFeatureEnabled: vi.fn(),
  assertCompanyFeatureEnabled: vi.fn(),
  requireAuthenticatedContextReadOnly: vi.fn(),
  upsertDeviceSubscription: vi.fn(),
  deactivateDeviceSubscription: vi.fn(),
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
  deactivateDeviceSubscription: mocks.deactivateDeviceSubscription,
  upsertDeviceSubscription: mocks.upsertDeviceSubscription,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

import { DELETE, POST } from "./route";

describe("push subscriptions route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.isFeatureEnabled.mockReturnValue(true);
    mocks.assertCompanyFeatureEnabled.mockResolvedValue({});
    mocks.requireAuthenticatedContextReadOnly.mockResolvedValue({
      companyId: "company-1",
      userId: "user-1",
    });
    mocks.upsertDeviceSubscription.mockResolvedValue({
      id: "sub-1",
      site_id: "cm0000000000000000000001",
      platform: "web",
      endpoint: "https://push.example.test/sub/1",
    });
    mocks.deactivateDeviceSubscription.mockResolvedValue({});
    mocks.createAuditLog.mockResolvedValue({});
  });

  it("returns 400 when subscription payload is missing required fields", async () => {
    const req = new Request("http://localhost/api/push/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("creates or updates subscription when payload is valid", async () => {
    const req = new Request("http://localhost/api/push/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        endpoint: "https://push.example.test/sub/1",
        keys: { p256dh: "pub-key", auth: "auth-key" },
        siteId: "cm0000000000000000000001",
        platform: "web",
      }),
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.subscriptionId).toBe("sub-1");
    expect(mocks.upsertDeviceSubscription).toHaveBeenCalledTimes(1);
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1);
  });

  it("deactivates subscription on DELETE", async () => {
    const req = new Request("http://localhost/api/push/subscriptions", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        endpoint: "https://push.example.test/sub/1",
      }),
    });
    const res = await DELETE(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.deactivateDeviceSubscription).toHaveBeenCalledWith(
      "company-1",
      "https://push.example.test/sub/1",
    );
  });
});
