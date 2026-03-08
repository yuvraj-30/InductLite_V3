import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  assertOrigin: vi.fn(),
  checkPermission: vi.fn(),
  checkAdminMutationRateLimit: vi.fn(),
  isFeatureEnabled: vi.fn(),
  requireAuthenticatedContextReadOnly: vi.fn(),
  assertCompanyFeatureEnabled: vi.fn(),
  listContractors: vi.fn(),
  upsertContractorPrequalification: vi.fn(),
  createCommunicationEvent: vi.fn(),
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

vi.mock("@/lib/repository/contractor.repository", () => ({
  listContractors: mocks.listContractors,
}));

vi.mock("@/lib/repository/permit.repository", () => ({
  upsertContractorPrequalification: mocks.upsertContractorPrequalification,
}));

vi.mock("@/lib/repository/communication.repository", () => ({
  createCommunicationEvent: mocks.createCommunicationEvent,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

import { importPrequalificationExchangeAction } from "./actions";

describe("prequalification exchange actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.checkPermission.mockResolvedValue({ success: true });
    mocks.checkAdminMutationRateLimit.mockResolvedValue({ success: true });
    mocks.isFeatureEnabled.mockReturnValue(true);
    mocks.requireAuthenticatedContextReadOnly.mockResolvedValue({
      companyId: "company-1",
      userId: "user-1",
    });
    mocks.assertCompanyFeatureEnabled.mockResolvedValue({});
    mocks.listContractors.mockResolvedValue({
      items: [
        {
          id: "ctr-1",
          name: "Acme Electrical",
          contact_email: "ops@acme.test",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 1000,
      totalPages: 1,
    });
    mocks.upsertContractorPrequalification.mockResolvedValue({});
    mocks.createCommunicationEvent.mockResolvedValue({});
    mocks.createAuditLog.mockResolvedValue({});
  });

  it("returns error when origin validation fails", async () => {
    mocks.assertOrigin.mockRejectedValue(new Error("Invalid request origin"));

    const result = await importPrequalificationExchangeAction(null, new FormData());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid request origin");
    }
  });

  it("imports matching external profiles and writes audit events", async () => {
    const formData = new FormData();
    formData.set("provider", "TOTIKA");
    formData.set("siteId", "cm0000000000000000000001");
    formData.set(
      "payloadJson",
      JSON.stringify([
        {
          externalId: "totika-123",
          contractorName: "Acme Electrical",
          contractorEmail: "ops@acme.test",
          status: "approved",
          score: 93,
          checklist: { hseq: "pass" },
        },
      ]),
    );

    const result = await importPrequalificationExchangeAction(null, formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.message).toContain("Imported 1 profiles");
    }
    expect(mocks.upsertContractorPrequalification).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        contractor_id: "ctr-1",
        site_id: "cm0000000000000000000001",
        status: "APPROVED",
        score: 93,
      }),
    );
    expect(mocks.createCommunicationEvent).toHaveBeenCalledTimes(1);
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/admin/prequalification-exchange",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/permits");
  });
});
