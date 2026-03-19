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
    count: vi.fn(),
    assertCompanyFeatureEnabled: vi.fn(),
    createAuditLog: vi.fn(),
    enforceBudgetPath: vi.fn(),
    EntitlementDeniedError: TestEntitlementDeniedError,
  };
});

vi.mock("@/lib/db/scoped-db", () => ({
  scopedDb: vi.fn(() => ({
    auditLog: {
      count: mocks.count,
    },
  })),
}));

vi.mock("@/lib/plans", () => ({
  assertCompanyFeatureEnabled: mocks.assertCompanyFeatureEnabled,
  EntitlementDeniedError: mocks.EntitlementDeniedError,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/lib/cost/budget-service", () => ({
  enforceBudgetPath: mocks.enforceBudgetPath,
}));

import { sendSmsWithQuota } from "../wrapper";

describe("sms wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SMS_ENABLED = "false";
    process.env.SMS_PROVIDER = "mock";
    process.env.MAX_MESSAGES_PER_COMPANY_PER_MONTH = "3";
    mocks.count.mockResolvedValue(0);
    mocks.assertCompanyFeatureEnabled.mockResolvedValue(undefined);
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.enforceBudgetPath.mockResolvedValue({
      allowed: true,
      controlId: null,
      violatedLimit: null,
      scope: "environment",
      message: "Budget state is healthy",
      state: { budgetTier: "MVP" },
    });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns disabled when sms guardrail is off", async () => {
    const result = await sendSmsWithQuota({
      companyId: "company-1",
      toE164: "+64211234567",
      message: "hello",
    });

    expect(result.status).toBe("DISABLED");
    expect(mocks.assertCompanyFeatureEnabled).not.toHaveBeenCalled();
  });

  it("returns denied when entitlement is disabled", async () => {
    process.env.SMS_ENABLED = "true";
    mocks.assertCompanyFeatureEnabled.mockRejectedValue(
      new mocks.EntitlementDeniedError("SMS_WORKFLOWS"),
    );

    const result = await sendSmsWithQuota({
      companyId: "company-1",
      siteId: "site-1",
      toE164: "+64211234567",
      message: "hello",
    });

    expect(result.status).toBe("DENIED");
    expect(result.controlId).toBe("PLAN-ENTITLEMENT-001");
  });

  it("returns denied when monthly quota is exhausted", async () => {
    process.env.SMS_ENABLED = "true";
    process.env.MAX_MESSAGES_PER_COMPANY_PER_MONTH = "1";
    mocks.count.mockResolvedValue(1);

    const result = await sendSmsWithQuota({
      companyId: "company-1",
      toE164: "+64211234567",
      message: "hello",
    });

    expect(result.status).toBe("DENIED");
    expect(result.controlId).toBe("SMS-GUARDRAIL-002");
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({ action: "sms.denied" }),
    );
  });

  it("returns denied when budget protect disables SMS notifications", async () => {
    process.env.SMS_ENABLED = "true";
    mocks.enforceBudgetPath.mockResolvedValue({
      allowed: false,
      controlId: "COST-008",
      violatedLimit: "PROJECTED_MONTHLY_SPEND_NZD<=150",
      scope: "environment",
      message:
        "This operation is disabled because the environment is in BUDGET_PROTECT mode",
      state: { budgetTier: "MVP" },
    });

    const result = await sendSmsWithQuota({
      companyId: "company-1",
      toE164: "+64211234567",
      message: "hello",
    });

    expect(result.status).toBe("DENIED");
    expect(result.controlId).toBe("COST-008");
    expect(result.reason).toContain("BUDGET_PROTECT");
  });

  it("sends with mock provider and records audit", async () => {
    process.env.SMS_ENABLED = "true";
    process.env.SMS_PROVIDER = "mock";

    const result = await sendSmsWithQuota({
      companyId: "company-1",
      toE164: "+64211234567",
      message: "hello world",
    });

    expect(result.status).toBe("SENT");
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({ action: "sms.sent" }),
    );
  });

  it("records failure when webhook provider errors", async () => {
    process.env.SMS_ENABLED = "true";
    process.env.SMS_PROVIDER = "webhook";
    process.env.SMS_WEBHOOK_URL = "https://sms.example.test/send";

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({}),
    } as Response);

    const result = await sendSmsWithQuota({
      companyId: "company-1",
      toE164: "+64211234567",
      message: "hello world",
    });

    expect(result.status).toBe("FAILED");
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({ action: "sms.failed" }),
    );
  });
});
