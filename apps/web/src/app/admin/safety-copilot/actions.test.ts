import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  assertOrigin: vi.fn(),
  checkPermission: vi.fn(),
  checkAdminMutationRateLimit: vi.fn(),
  isFeatureEnabled: vi.fn(),
  requireAuthenticatedContextReadOnly: vi.fn(),
  assertCompanyFeatureEnabled: vi.fn(),
  countCommunicationEventsSince: vi.fn(),
  createCommunicationEvent: vi.fn(),
  createAuditLog: vi.fn(),
  generateSafetyCopilotResponse: vi.fn(),
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

vi.mock("@/lib/repository/communication.repository", () => ({
  createCommunicationEvent: mocks.createCommunicationEvent,
  countCommunicationEventsSince: mocks.countCommunicationEventsSince,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/lib/differentiation/safety-copilot", () => ({
  generateSafetyCopilotResponse: mocks.generateSafetyCopilotResponse,
}));

import { runSafetyCopilotAction } from "./actions";

describe("safety copilot actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAX_POLICY_SIM_RUNS_PER_COMPANY_PER_DAY = "3";

    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.checkPermission.mockResolvedValue({ success: true });
    mocks.checkAdminMutationRateLimit.mockResolvedValue({ success: true });
    mocks.isFeatureEnabled.mockReturnValue(true);
    mocks.requireAuthenticatedContextReadOnly.mockResolvedValue({
      companyId: "company-1",
      userId: "user-1",
    });
    mocks.assertCompanyFeatureEnabled.mockResolvedValue({});
    mocks.countCommunicationEventsSince.mockResolvedValue(0);
    mocks.generateSafetyCopilotResponse.mockResolvedValue({
      summary: "Work area has elevated vehicle movement risk.",
      recommendations: ["Stagger deliveries", "Set one-way traffic lane"],
      signals: [{ id: "traffic", weight: 0.75 }],
    });
    mocks.createCommunicationEvent.mockResolvedValue({});
    mocks.createAuditLog.mockResolvedValue({});
  });

  it("returns error when daily quota is reached", async () => {
    mocks.countCommunicationEventsSince.mockResolvedValue(3);
    const formData = new FormData();
    formData.set("siteId", "cm0000000000000000000001");
    formData.set("prompt", "Provide actions to reduce reversing incidents today.");

    const result = await runSafetyCopilotAction(null, formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("CONTROL_ID: QUOTA-COPILOT-001");
    }
    expect(mocks.generateSafetyCopilotResponse).not.toHaveBeenCalled();
  });

  it("runs copilot, logs communication, and revalidates page", async () => {
    const formData = new FormData();
    formData.set("siteId", "cm0000000000000000000001");
    formData.set("prompt", "Provide actions to reduce reversing incidents today.");

    const result = await runSafetyCopilotAction(null, formData);

    expect(result).toEqual({
      success: true,
      message: "Safety copilot run completed",
    });
    expect(mocks.generateSafetyCopilotResponse).toHaveBeenCalledWith({
      companyId: "company-1",
      siteId: "cm0000000000000000000001",
      prompt: "Provide actions to reduce reversing incidents today.",
    });
    expect(mocks.createCommunicationEvent).toHaveBeenCalledTimes(1);
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/safety-copilot");
  });
});
