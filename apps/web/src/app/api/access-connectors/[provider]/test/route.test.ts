import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertOrigin: vi.fn(),
  requireAuthenticatedContextReadOnly: vi.fn(),
  checkSitePermission: vi.fn(),
  isFeatureEnabled: vi.fn(),
  assertCompanyFeatureEnabled: vi.fn(),
  findSiteById: vi.fn(),
  findActiveAccessConnectorConfig: vi.fn(),
  upsertAccessConnectorConfig: vi.fn(),
  dispatchAccessConnectorCommand: vi.fn(),
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

vi.mock("@/lib/tenant/context", () => ({
  requireAuthenticatedContextReadOnly: mocks.requireAuthenticatedContextReadOnly,
}));

vi.mock("@/lib/auth", () => ({
  checkSitePermission: mocks.checkSitePermission,
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: mocks.isFeatureEnabled,
}));

vi.mock("@/lib/plans", () => ({
  EntitlementDeniedError: mocks.EntitlementDeniedError,
  assertCompanyFeatureEnabled: mocks.assertCompanyFeatureEnabled,
}));

vi.mock("@/lib/repository/site.repository", () => ({
  findSiteById: mocks.findSiteById,
}));

vi.mock("@/lib/repository/access-connector.repository", () => ({
  findActiveAccessConnectorConfig: mocks.findActiveAccessConnectorConfig,
  upsertAccessConnectorConfig: mocks.upsertAccessConnectorConfig,
}));

vi.mock("@/lib/access-connectors", () => ({
  dispatchAccessConnectorCommand: mocks.dispatchAccessConnectorCommand,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

import { POST } from "./route";

describe("POST /api/access-connectors/[provider]/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.requireAuthenticatedContextReadOnly.mockResolvedValue({
      companyId: "company-1",
      userId: "user-1",
      role: "ADMIN",
    });
    mocks.checkSitePermission.mockResolvedValue({ success: true });
    mocks.isFeatureEnabled.mockReturnValue(true);
    mocks.assertCompanyFeatureEnabled.mockResolvedValue({});
    mocks.findSiteById.mockResolvedValue({
      id: "cm0000000000000000000001",
      name: "Alpha Site",
      access_control: {
        hardware: {
          enabled: true,
          endpointUrl: "https://hardware.example.test/events",
          provider: "HID_ORIGO",
        },
      },
    });
    mocks.findActiveAccessConnectorConfig.mockResolvedValue({
      id: "conn-1",
      endpoint_url: "https://hardware.example.test/events",
    });
    mocks.upsertAccessConnectorConfig.mockResolvedValue({});
    mocks.dispatchAccessConnectorCommand.mockResolvedValue({
      queued: true,
      mode: "provider",
      provider: "HID_ORIGO",
      reason: "provider_connector_queued",
      targetUrl: "https://hardware.example.test/events",
    });
    mocks.createAuditLog.mockResolvedValue({});
  });

  it("returns 400 when provider is unsupported", async () => {
    const response = await POST(
      new Request("http://localhost/api/access-connectors/bad/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteId: "cm0000000000000000000001" }),
      }) as any,
      { params: Promise.resolve({ provider: "bad" }) },
    );

    expect(response.status).toBe(400);
  });

  it("queues connector test dispatch", async () => {
    const response = await POST(
      new Request("http://localhost/api/access-connectors/hid_origo/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteId: "cm0000000000000000000001" }),
      }) as any,
      { params: Promise.resolve({ provider: "hid_origo" }) },
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.mode).toBe("provider");
    expect(mocks.dispatchAccessConnectorCommand).toHaveBeenCalledTimes(1);
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1);
  });

  it("accepts newly added providers and persists config when endpoint is sent", async () => {
    mocks.dispatchAccessConnectorCommand.mockResolvedValue({
      queued: true,
      mode: "provider",
      provider: "GALLAGHER",
      reason: "provider_connector_queued",
      targetUrl: "https://hardware.example.test/gallagher",
    });

    const response = await POST(
      new Request("http://localhost/api/access-connectors/gallagher/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          siteId: "cm0000000000000000000001",
          endpointUrl: "https://hardware.example.test/gallagher",
          authToken: "token-1",
          settings: { lane: "north" },
        }),
      }) as any,
      { params: Promise.resolve({ provider: "gallagher" }) },
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.provider).toBe("GALLAGHER");
    expect(mocks.upsertAccessConnectorConfig).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        provider: "GALLAGHER",
        site_id: "cm0000000000000000000001",
        endpoint_url: "https://hardware.example.test/gallagher",
      }),
    );
  });
});
