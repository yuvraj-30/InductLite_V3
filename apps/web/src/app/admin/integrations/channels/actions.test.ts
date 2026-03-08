import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  assertOrigin: vi.fn(),
  checkPermission: vi.fn(),
  isFeatureEnabled: vi.fn(),
  generateRequestId: vi.fn(),
  createRequestLogger: vi.fn(),
  checkAdminMutationRateLimit: vi.fn(),
  requireAuthenticatedContextReadOnly: vi.fn(),
  findChannelIntegrationConfigById: vi.fn(),
  upsertChannelIntegrationConfig: vi.fn(),
  createAuditLog: vi.fn(),
  assertCompanyFeatureEnabled: vi.fn(),
  sendChannelTestMessageAction: vi.fn(),
  logger: { error: vi.fn() },
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

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: mocks.isFeatureEnabled,
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: mocks.generateRequestId,
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkAdminMutationRateLimit: mocks.checkAdminMutationRateLimit,
}));

vi.mock("@/lib/tenant/context", () => ({
  requireAuthenticatedContextReadOnly: mocks.requireAuthenticatedContextReadOnly,
}));

vi.mock("@/lib/repository/communication.repository", () => ({
  findChannelIntegrationConfigById: mocks.findChannelIntegrationConfigById,
  upsertChannelIntegrationConfig: mocks.upsertChannelIntegrationConfig,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/lib/plans", () => ({
  EntitlementDeniedError: mocks.EntitlementDeniedError,
  assertCompanyFeatureEnabled: mocks.assertCompanyFeatureEnabled,
}));

vi.mock("@/app/admin/communications/actions", () => ({
  sendChannelTestMessageAction: mocks.sendChannelTestMessageAction,
}));

import {
  deactivateChannelIntegrationAction,
  sendChannelIntegrationTestAction,
  upsertChannelIntegrationAction,
} from "./actions";

describe("channel integration actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.checkPermission.mockResolvedValue({ success: true });
    mocks.isFeatureEnabled.mockReturnValue(true);
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.createRequestLogger.mockReturnValue(mocks.logger);
    mocks.checkAdminMutationRateLimit.mockResolvedValue({ success: true });
    mocks.requireAuthenticatedContextReadOnly.mockResolvedValue({
      companyId: "company-1",
      userId: "user-1",
    });
    mocks.assertCompanyFeatureEnabled.mockResolvedValue({});
    mocks.findChannelIntegrationConfigById.mockResolvedValue({
      id: "cm0000000000000000000009",
      site_id: "cm0000000000000000000001",
      provider: "SLACK",
      endpoint_url: "https://hooks.slack.com/services/a/b/c",
      auth_token: "token-1",
      signing_secret: "secret-1",
      mappings: { alerts: "C01" },
    });
    mocks.upsertChannelIntegrationConfig.mockResolvedValue({
      id: "cm0000000000000000000009",
      site_id: "cm0000000000000000000001",
      provider: "SLACK",
      endpoint_url: "https://hooks.slack.com/services/a/b/c",
      is_active: true,
    });
    mocks.createAuditLog.mockResolvedValue({});
    mocks.sendChannelTestMessageAction.mockResolvedValue({
      success: true,
      message: "Test message queued",
    });
  });

  it("returns feature-flag error when channels are disabled", async () => {
    mocks.isFeatureEnabled.mockReturnValue(false);
    const formData = new FormData();
    formData.set("siteId", "cm0000000000000000000001");
    formData.set("provider", "SLACK");
    formData.set("endpointUrl", "https://hooks.slack.com/services/a/b/c");

    const result = await upsertChannelIntegrationAction(null, formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("FLAG-ROLLOUT-001");
    }
  });

  it("upserts channel integration and writes audit entry", async () => {
    const formData = new FormData();
    formData.set("integrationId", "cm0000000000000000000009");
    formData.set("siteId", "cm0000000000000000000001");
    formData.set("provider", "SLACK");
    formData.set("endpointUrl", "https://hooks.slack.com/services/a/b/c");
    formData.set("authToken", "token-1");
    formData.set("signingSecret", "secret-1");
    formData.set("mappingsJson", '{"alerts":"C01"}');
    formData.set("isActive", "on");

    const result = await upsertChannelIntegrationAction(null, formData);

    expect(result).toEqual({ success: true, message: "Channel integration saved" });
    expect(mocks.upsertChannelIntegrationConfig).toHaveBeenCalledTimes(1);
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "channel.integration.upsert",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/integrations/channels");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/communications");
  });

  it("deactivates config and sends channel test message", async () => {
    const deactivateResult = await deactivateChannelIntegrationAction(
      "cm0000000000000000000009",
    );
    const testResult = await sendChannelIntegrationTestAction(
      "cm0000000000000000000009",
    );

    expect(deactivateResult).toEqual({
      success: true,
      message: "Channel integration deactivated",
    });
    expect(testResult).toEqual({ success: true, message: "Test message queued" });
    expect(mocks.sendChannelTestMessageAction).toHaveBeenCalledTimes(1);
  });
});
