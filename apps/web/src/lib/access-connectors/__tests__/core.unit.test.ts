import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isFeatureEnabled: vi.fn(),
  assertCompanyFeatureEnabled: vi.fn(),
  findActiveAccessConnectorConfig: vi.fn(),
  createAccessConnectorHealthEvent: vi.fn(),
  countOutboundWebhookDeliveriesSince: vi.fn(),
  queueOutboundWebhookDeliveries: vi.fn(),
  GUARDRAILS: {
    MAX_CONNECTOR_DELIVERIES_PER_COMPANY_PER_DAY: 10_000,
  },
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

vi.mock("@/lib/guardrails", () => ({
  GUARDRAILS: mocks.GUARDRAILS,
}));

vi.mock("@/lib/plans", () => ({
  EntitlementDeniedError: mocks.EntitlementDeniedError,
  assertCompanyFeatureEnabled: mocks.assertCompanyFeatureEnabled,
}));

vi.mock("@/lib/repository/access-connector.repository", () => ({
  findActiveAccessConnectorConfig: mocks.findActiveAccessConnectorConfig,
  createAccessConnectorHealthEvent: mocks.createAccessConnectorHealthEvent,
}));

vi.mock("@/lib/repository/webhook-delivery.repository", () => ({
  countOutboundWebhookDeliveriesSince: mocks.countOutboundWebhookDeliveriesSince,
  queueOutboundWebhookDeliveries: mocks.queueOutboundWebhookDeliveries,
}));

import { dispatchAccessConnectorCommand } from "../core";

describe("access connector dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isFeatureEnabled.mockReturnValue(true);
    mocks.assertCompanyFeatureEnabled.mockResolvedValue({});
    mocks.findActiveAccessConnectorConfig.mockResolvedValue({
      id: "conn-1",
      endpoint_url: "https://connector.example.test/dispatch",
    });
    mocks.createAccessConnectorHealthEvent.mockResolvedValue({});
    mocks.countOutboundWebhookDeliveriesSince.mockResolvedValue(0);
    mocks.queueOutboundWebhookDeliveries.mockResolvedValue(1);
    mocks.GUARDRAILS.MAX_CONNECTOR_DELIVERIES_PER_COMPANY_PER_DAY = 10_000;
  });

  it("returns none when hardware target is missing", async () => {
    const result = await dispatchAccessConnectorCommand({
      companyId: "company-1",
      siteId: "site-1",
      siteName: "Alpha",
      accessControl: null,
      correlationId: "corr-1",
      command: "status",
      reason: "test",
    });

    expect(result.mode).toBe("none");
    expect(result.queued).toBe(false);
  });

  it("queues provider connector delivery when active config exists", async () => {
    const result = await dispatchAccessConnectorCommand({
      companyId: "company-1",
      siteId: "site-1",
      siteName: "Alpha",
      accessControl: {
        hardware: {
          enabled: true,
          provider: "HID_ORIGO",
          endpointUrl: "https://fallback.example.test/hardware",
        },
      },
      correlationId: "corr-2",
      command: "grant",
      reason: "sign_in_success",
      visitorName: "Ari",
      visitorPhoneE164: "+64211234567",
    });

    expect(result.queued).toBe(true);
    expect(result.mode).toBe("provider");
    expect(result.provider).toBe("HID_ORIGO");
    expect(mocks.queueOutboundWebhookDeliveries).toHaveBeenCalledTimes(1);
    expect(mocks.createAccessConnectorHealthEvent).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        provider: "HID_ORIGO",
        status: "HEALTHY",
      }),
    );
  });

  it("falls back to generic endpoint when provider config is missing", async () => {
    mocks.findActiveAccessConnectorConfig.mockResolvedValue(null);

    const result = await dispatchAccessConnectorCommand({
      companyId: "company-1",
      siteId: "site-1",
      siteName: "Alpha",
      accessControl: {
        hardware: {
          enabled: true,
          provider: "GALLAGHER",
          endpointUrl: "https://fallback.example.test/hardware",
        },
      },
      correlationId: "corr-4",
      command: "status",
      reason: "test",
    });

    expect(result.queued).toBe(true);
    expect(result.mode).toBe("generic");
    expect(result.provider).toBe("GENERIC");
    expect(result.reason).toBe("generic_connector_queued");
    expect(mocks.createAccessConnectorHealthEvent).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        provider: "GALLAGHER",
        status: "DEGRADED",
        reason: "provider_config_missing",
      }),
    );
  });

  it("returns deterministic reason when connector delivery cap is reached", async () => {
    mocks.GUARDRAILS.MAX_CONNECTOR_DELIVERIES_PER_COMPANY_PER_DAY = 5;
    mocks.countOutboundWebhookDeliveriesSince.mockResolvedValue(5);

    const result = await dispatchAccessConnectorCommand({
      companyId: "company-1",
      siteId: "site-1",
      siteName: "Alpha",
      accessControl: {
        hardware: {
          enabled: true,
          provider: "GENERIC",
          endpointUrl: "https://fallback.example.test/hardware",
        },
      },
      correlationId: "corr-3",
      command: "status",
      reason: "test",
    });

    expect(result.queued).toBe(false);
    expect(result.reason).toBe("connector_delivery_cap_reached");
    expect(result.controlId).toBe("CONNECTOR-GUARDRAIL-001");
  });
});
