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
  assertCompanyFeatureEnabled: vi.fn(),
  requireAuthenticatedContextReadOnly: vi.fn(),
  createAuditLog: vi.fn(),
  findSiteById: vi.fn(),
  updateSite: vi.fn(),
  parseWebhookConfig: vi.fn(),
  buildWebhookConfigFromUrls: vi.fn(),
  rotateWebhookSigningSecret: vi.fn(),
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

vi.mock("@/lib/webhook/config", () => ({
  parseWebhookConfig: mocks.parseWebhookConfig,
  buildWebhookConfigFromUrls: mocks.buildWebhookConfigFromUrls,
  rotateWebhookSigningSecret: mocks.rotateWebhookSigningSecret,
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: mocks.generateRequestId,
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

vi.mock("@/lib/plans", () => ({
  EntitlementDeniedError: mocks.EntitlementDeniedError,
  assertCompanyFeatureEnabled: mocks.assertCompanyFeatureEnabled,
}));

import {
  rotateSiteWebhookSecretAction,
  updateSiteWebhooksAction,
} from "./actions";

const BASE_CONFIG = {
  version: 2 as const,
  endpoints: [],
  signingSecret: null,
  signingSecretUpdatedAt: null,
};

describe("site webhook actions", () => {
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
      webhooks: null,
    });
    mocks.parseWebhookConfig.mockReturnValue(BASE_CONFIG);
    mocks.rotateWebhookSigningSecret.mockReturnValue(
      "rotated-secret-1234567890",
    );
    mocks.buildWebhookConfigFromUrls.mockImplementation(
      ({ urls, signingSecret }) => ({
        version: 2,
        endpoints: urls.map((url: string, index: number) => ({
          id: `endpoint-${index}`,
          url,
          enabled: true,
          events: ["induction.completed"],
          createdAt: "2026-02-28T00:00:00.000Z",
          updatedAt: "2026-02-28T00:00:00.000Z",
        })),
        signingSecret: signingSecret ?? null,
        signingSecretUpdatedAt:
          signingSecret != null ? "2026-02-28T00:00:00.000Z" : null,
      }),
    );
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.createRequestLogger.mockReturnValue(mocks.logger);
  });

  it("updates endpoints and writes audit evidence", async () => {
    const formData = new FormData();
    formData.set(
      "endpointUrls",
      [
        "https://example.com/webhooks/one",
        "https://example.com/webhooks/two",
        "https://example.com/webhooks/one",
      ].join("\n"),
    );

    const result = await updateSiteWebhooksAction("site-1", null, formData);

    expect(result.success).toBe(true);
    expect(mocks.updateSite).toHaveBeenCalledWith(
      "company-1",
      "site-1",
      expect.objectContaining({
        webhooks: expect.objectContaining({
          endpoints: expect.arrayContaining([
            expect.objectContaining({ url: "https://example.com/webhooks/one" }),
            expect.objectContaining({ url: "https://example.com/webhooks/two" }),
          ]),
        }),
      }),
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "site.webhooks_update",
        entity_id: "site-1",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/sites/site-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/admin/sites/site-1/webhooks",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/webhooks");
    expect(mocks.assertCompanyFeatureEnabled).toHaveBeenCalledWith(
      "company-1",
      "WEBHOOKS_OUTBOUND",
      "site-1",
    );
  });

  it("returns field error for invalid endpoint url", async () => {
    const formData = new FormData();
    formData.set("endpointUrls", "not-a-url");

    const result = await updateSiteWebhooksAction("site-1", null, formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("invalid");
      expect(result.fieldErrors?.endpointUrls?.[0]).toContain("Invalid URL");
    }
    expect(mocks.updateSite).not.toHaveBeenCalled();
  });

  it("rotates site signing secret and persists new value", async () => {
    mocks.parseWebhookConfig.mockReturnValue({
      ...BASE_CONFIG,
      endpoints: [
        {
          id: "endpoint-1",
          url: "https://example.com/webhooks/one",
          enabled: true,
          events: ["induction.completed"],
          createdAt: "2026-02-27T00:00:00.000Z",
          updatedAt: "2026-02-27T00:00:00.000Z",
        },
      ],
    });

    const result = await rotateSiteWebhookSecretAction(
      "site-1",
      null,
      new FormData(),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.generatedSecret).toBe("rotated-secret-1234567890");
    }

    expect(mocks.rotateWebhookSigningSecret).toHaveBeenCalledTimes(1);
    expect(mocks.updateSite).toHaveBeenCalledWith(
      "company-1",
      "site-1",
      expect.objectContaining({
        webhooks: expect.objectContaining({
          signingSecret: "rotated-secret-1234567890",
        }),
      }),
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "site.webhooks_secret_rotate",
        entity_id: "site-1",
      }),
    );
  });

  it("denies webhook updates when entitlement is disabled", async () => {
    mocks.assertCompanyFeatureEnabled.mockRejectedValue(
      new mocks.EntitlementDeniedError("WEBHOOKS_OUTBOUND"),
    );

    const result = await updateSiteWebhooksAction("site-1", null, new FormData());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("disabled for this site plan");
    }
    expect(mocks.updateSite).not.toHaveBeenCalled();
  });

  it("denies signing-secret rotation when entitlement is disabled", async () => {
    mocks.assertCompanyFeatureEnabled.mockRejectedValue(
      new mocks.EntitlementDeniedError("WEBHOOKS_OUTBOUND"),
    );

    const result = await rotateSiteWebhookSecretAction(
      "site-1",
      null,
      new FormData(),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("disabled for this site plan");
    }
    expect(mocks.updateSite).not.toHaveBeenCalled();
  });
});
