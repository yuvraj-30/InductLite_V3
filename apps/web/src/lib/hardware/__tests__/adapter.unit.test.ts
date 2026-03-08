import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class TestEntitlementDeniedError extends Error {
    constructor(
      public readonly featureKey: string,
      public readonly controlId: string = "PLAN-ENTITLEMENT-001",
    ) {
      super("denied");
      this.name = "EntitlementDeniedError";
    }
  }

  return {
    assertCompanyFeatureEnabled: vi.fn(),
    dispatchAccessConnectorCommand: vi.fn(),
    createAuditLog: vi.fn(),
    createAccessDecisionTrace: vi.fn(),
    createHardwareOutageEvent: vi.fn(),
    EntitlementDeniedError: TestEntitlementDeniedError,
  };
});

vi.mock("@/lib/plans", () => ({
  assertCompanyFeatureEnabled: mocks.assertCompanyFeatureEnabled,
  EntitlementDeniedError: mocks.EntitlementDeniedError,
}));

vi.mock("@/lib/access-connectors", () => ({
  dispatchAccessConnectorCommand: mocks.dispatchAccessConnectorCommand,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/lib/repository/hardware-trace.repository", () => ({
  createAccessDecisionTrace: mocks.createAccessDecisionTrace,
  createHardwareOutageEvent: mocks.createHardwareOutageEvent,
}));

import { queueHardwareAccessDecision } from "../adapter";

describe("hardware adapter queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCompanyFeatureEnabled.mockResolvedValue(undefined);
    mocks.dispatchAccessConnectorCommand.mockResolvedValue({
      queued: true,
      mode: "generic",
      provider: "GENERIC",
      reason: "generic_connector_queued",
      targetUrl: "https://hardware.example.test/events",
    });
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.createAccessDecisionTrace.mockResolvedValue(undefined);
    mocks.createHardwareOutageEvent.mockResolvedValue(undefined);
  });

  it("queues decision when target is configured and entitlement allows", async () => {
    const result = await queueHardwareAccessDecision({
      companyId: "company-1",
      siteId: "site-1",
      siteName: "Alpha",
      accessControl: {
        hardware: {
          enabled: true,
          endpointUrl: "https://hardware.example.test/events",
          provider: "GENERIC",
        },
      },
      decision: "ALLOW",
      reason: "sign_in_success",
      signInRecordId: "signin-1",
      visitorName: "Visitor",
      visitorPhoneE164: "+64211234567",
    });

    expect(result).toEqual({ queued: true, reason: "generic_connector_queued" });
    expect(mocks.dispatchAccessConnectorCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        siteId: "site-1",
        command: "grant",
        reason: "sign_in_success",
      }),
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({ action: "hardware.access_queued" }),
    );
  });

  it("returns disabled when entitlement blocks hardware", async () => {
    mocks.assertCompanyFeatureEnabled.mockRejectedValue(
      new mocks.EntitlementDeniedError("HARDWARE_ACCESS"),
    );

    const result = await queueHardwareAccessDecision({
      companyId: "company-1",
      siteId: "site-1",
      siteName: "Alpha",
      accessControl: {
        hardware: {
          enabled: true,
          endpointUrl: "https://hardware.example.test/events",
        },
      },
      decision: "DENY",
      reason: "geofence_outside_radius",
    });

    expect(result).toEqual({
      queued: false,
      reason: "hardware_entitlement_disabled",
    });
  });
});
