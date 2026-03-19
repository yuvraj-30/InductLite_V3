import { describe, it, expect, vi, beforeEach } from "vitest";

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
  assertOrigin: vi.fn(),
  checkAdmin: vi.fn(),
  requireAuthenticatedContextReadOnly: vi.fn(),
  assertCompanyFeatureEnabled: vi.fn(),
  queueExportJobWithLimits: vi.fn(),
  createAuditLog: vi.fn(),
  revalidatePath: vi.fn(),
  generateRequestId: vi.fn(),
  isFeatureEnabled: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createRequestLogger: vi.fn(),
  enforceBudgetPath: vi.fn(),
  startBudgetTrackedOperation: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth", () => ({
  assertOrigin: mocks.assertOrigin,
  checkAdmin: mocks.checkAdmin,
}));

vi.mock("@/lib/tenant/context", () => ({
  requireAuthenticatedContextReadOnly: mocks.requireAuthenticatedContextReadOnly,
}));

vi.mock("@/lib/repository/export.repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/repository/export.repository")
  >("@/lib/repository/export.repository");
  return {
    ...actual,
    queueExportJobWithLimits: mocks.queueExportJobWithLimits,
  };
});

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: mocks.generateRequestId,
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: mocks.isFeatureEnabled,
}));

vi.mock("@/lib/plans", () => ({
  EntitlementDeniedError: mocks.EntitlementDeniedError,
  assertCompanyFeatureEnabled: mocks.assertCompanyFeatureEnabled,
}));

vi.mock("@/lib/cost/budget-service", () => ({
  enforceBudgetPath: mocks.enforceBudgetPath,
  startBudgetTrackedOperation: mocks.startBudgetTrackedOperation,
}));

import { createExportAction } from "./actions";
import { ExportGlobalBytesLimitReachedError } from "@/lib/repository/export.repository";

describe("createExportAction guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.checkAdmin.mockResolvedValue({ success: true });
    mocks.requireAuthenticatedContextReadOnly.mockResolvedValue({
      companyId: "company-1",
      userId: "user-1",
    });
    mocks.assertCompanyFeatureEnabled.mockResolvedValue(undefined);
    mocks.queueExportJobWithLimits.mockResolvedValue({ id: "job-1" });
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.isFeatureEnabled.mockReturnValue(true);
    mocks.createRequestLogger.mockReturnValue(mocks.logger);
    mocks.enforceBudgetPath.mockResolvedValue({
      allowed: true,
      controlId: null,
      violatedLimit: null,
      scope: "environment",
      message: "Budget state is healthy",
      state: { budgetTier: "MVP" },
    });
    mocks.startBudgetTrackedOperation.mockReturnValue(vi.fn());
  });

  it("maps global export-byte budget denial to deterministic EXPT-002 payload", async () => {
    mocks.queueExportJobWithLimits.mockRejectedValue(
      new ExportGlobalBytesLimitReachedError(),
    );

    const result = await createExportAction({ exportType: "SIGN_IN_CSV" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("RATE_LIMITED");
      expect(result.error.guardrail?.controlId).toBe("EXPT-002");
      expect(result.error.guardrail?.scope).toBe("environment");
      expect(result.error.guardrail?.violatedLimit).toContain(
        "MAX_EXPORT_BYTES_GLOBAL_PER_DAY=",
      );
      expect(result.error.message).toContain("Global export generation budget");
    }

    expect(mocks.createAuditLog).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("denies advanced exports when EXPORTS_ADVANCED entitlement is disabled", async () => {
    mocks.assertCompanyFeatureEnabled.mockRejectedValue(
      new mocks.EntitlementDeniedError("EXPORTS_ADVANCED"),
    );

    const result = await createExportAction({ exportType: "COMPLIANCE_ZIP" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("FORBIDDEN");
      expect(result.error.message).toBe(
        "Advanced export bundles are disabled for your current plan",
      );
    }

    expect(mocks.queueExportJobWithLimits).not.toHaveBeenCalled();
  });

  it("returns deterministic budget-protect payload when export creation is disabled", async () => {
    mocks.enforceBudgetPath.mockResolvedValue({
      allowed: false,
      controlId: "COST-008",
      violatedLimit: "PROJECTED_MONTHLY_SPEND_NZD<=150",
      scope: "environment",
      message:
        "This operation is disabled because the environment is in BUDGET_PROTECT mode",
      state: { budgetTier: "MVP" },
    });

    const result = await createExportAction({ exportType: "SIGN_IN_CSV" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("RATE_LIMITED");
      expect(result.error.guardrail?.controlId).toBe("COST-008");
      expect(result.error.guardrail?.scope).toBe("environment");
      expect(result.error.guardrail?.violatedLimit).toBe(
        "PROJECTED_MONTHLY_SPEND_NZD<=150",
      );
    }

    expect(mocks.queueExportJobWithLimits).not.toHaveBeenCalled();
  });
});
