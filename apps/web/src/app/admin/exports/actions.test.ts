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
  getExportOffPeakDecision: vi.fn(),
  findSiteById: vi.fn(),
  processNextExportJob: vi.fn(),
  isOffPeakNow: vi.fn(),
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
    getExportOffPeakDecision: mocks.getExportOffPeakDecision,
  };
});

vi.mock("@/lib/repository/site.repository", () => ({
  findSiteById: mocks.findSiteById,
}));

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

vi.mock("@/lib/guardrails", async () => {
  const actual = await vi.importActual<typeof import("@/lib/guardrails")>(
    "@/lib/guardrails",
  );
  return {
    ...actual,
    isOffPeakNow: mocks.isOffPeakNow,
  };
});

vi.mock("@/lib/plans", () => ({
  EntitlementDeniedError: mocks.EntitlementDeniedError,
  assertCompanyFeatureEnabled: mocks.assertCompanyFeatureEnabled,
}));

vi.mock("@/lib/cost/budget-service", () => ({
  enforceBudgetPath: mocks.enforceBudgetPath,
  startBudgetTrackedOperation: mocks.startBudgetTrackedOperation,
}));

vi.mock("@/lib/export/runner", () => ({
  processNextExportJob: mocks.processNextExportJob,
}));

import {
  createExportAction,
  createExportFormAction,
  runQueuedExportNowAction,
  runQueuedExportNowFormAction,
} from "./actions";
import {
  ExportGlobalBytesLimitReachedError,
  ExportQueueAgeLimitReachedError,
} from "@/lib/repository/export.repository";

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
    mocks.getExportOffPeakDecision.mockResolvedValue({
      active: false,
      reason: "disabled",
      thresholdPercent: 20,
      queueDelaySeconds: 60,
      windowDays: 7,
      delayedJobs: 0,
      observedJobs: 0,
      delayedPercent: 0,
    });
    mocks.isOffPeakNow.mockReturnValue(false);
    mocks.findSiteById.mockResolvedValue({ id: "site-1", name: "Central Yard" });
    mocks.processNextExportJob.mockResolvedValue({ id: "job-1", status: "SUCCEEDED" });
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

  it("returns deterministic EXPT-014 payload when queue age pressure blocks new exports", async () => {
    mocks.queueExportJobWithLimits.mockRejectedValue(
      new ExportQueueAgeLimitReachedError(61),
    );

    const result = await createExportAction({ exportType: "SIGN_IN_CSV" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("RATE_LIMITED");
      expect(result.error.guardrail?.controlId).toBe("EXPT-014");
      expect(result.error.guardrail?.scope).toBe("environment");
      expect(result.error.message).toContain("queue pressure");
    }
  });

  it("returns deterministic auto-offpeak payload when scheduler policy is active", async () => {
    mocks.getExportOffPeakDecision.mockResolvedValue({
      active: true,
      reason: "auto",
      thresholdPercent: 20,
      queueDelaySeconds: 60,
      windowDays: 7,
      delayedJobs: 2,
      observedJobs: 8,
      delayedPercent: 25,
    });

    const result = await createExportAction({ exportType: "SIGN_IN_CSV" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("RATE_LIMITED");
      expect(result.error.guardrail?.controlId).toBe("EXPT-005");
      expect(result.error.guardrail?.scope).toBe("environment");
      expect(result.error.message).toContain("off-peak hours");
    }

    expect(mocks.queueExportJobWithLimits).not.toHaveBeenCalled();
  });

  it("rejects unknown site filters before queueing", async () => {
    mocks.findSiteById.mockResolvedValue(null);

    const result = await createExportAction({
      exportType: "SIGN_IN_CSV",
      siteId: "c123456789012345678901234",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.fieldErrors?.siteId).toEqual([
        "Selected site was not found.",
      ]);
    }

    expect(mocks.queueExportJobWithLimits).not.toHaveBeenCalled();
  });

  it("rejects unsupported contractor filters before queueing", async () => {
    const result = await createExportAction({
      exportType: "SIGN_IN_CSV",
      contractorIds: ["c123456789012345678901235"],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.fieldErrors?.contractorIds).toEqual([
        "Contractor filters are not supported for exports yet.",
      ]);
    }

    expect(mocks.queueExportJobWithLimits).not.toHaveBeenCalled();
  });

  it("queues exports from FormData payloads", async () => {
    const formData = new FormData();
    formData.set("exportType", "COMPLIANCE_ZIP");
    formData.set("dateFrom", "2026-03-22T00:00:00.000Z");
    formData.set("dateTo", "2026-03-22T23:59:59.000Z");

    const result = await createExportFormAction(null, formData);

    expect(result).not.toBeNull();
    if (!result) {
      throw new Error("Expected export form action result");
    }
    expect(result.success).toBe(true);
    expect(mocks.queueExportJobWithLimits).toHaveBeenCalledWith("company-1", {
      export_type: "COMPLIANCE_ZIP",
      parameters: {
        exportType: "COMPLIANCE_ZIP",
        dateFrom: "2026-03-22T00:00:00.000Z",
        dateTo: "2026-03-22T23:59:59.000Z",
      },
      requested_by: "user-1",
    });
  });

  it("runs the next queued export for the current company on demand", async () => {
    const result = await runQueuedExportNowAction();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        processed: true,
        status: "SUCCEEDED",
        exportJobId: "job-1",
      });
    }
    expect(mocks.processNextExportJob).toHaveBeenCalledWith({
      companyId: "company-1",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/exports");
  });

  it("returns a noop success when no queued export is eligible", async () => {
    mocks.processNextExportJob.mockResolvedValue(null);

    const result = await runQueuedExportNowAction();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        processed: false,
        status: "NOOP",
      });
    }
  });

  it("runs queued exports from form actions too", async () => {
    const result = await runQueuedExportNowFormAction(null, new FormData());

    expect(result).not.toBeNull();
    if (!result) {
      throw new Error("Expected queue recovery result");
    }
    expect(result.success).toBe(true);
    expect(mocks.processNextExportJob).toHaveBeenCalledWith({
      companyId: "company-1",
    });
  });
});
