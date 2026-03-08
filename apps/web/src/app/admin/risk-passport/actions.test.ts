import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    const error = new Error(`REDIRECT:${url}`) as Error & { digest: string };
    error.digest = `NEXT_REDIRECT;${url}`;
    throw error;
  }),
  assertOrigin: vi.fn(),
  checkPermission: vi.fn(),
  requireAuthenticatedContextReadOnly: vi.fn(),
  checkAdminMutationRateLimit: vi.fn(),
  isFeatureEnabled: vi.fn(),
  assertCompanyFeatureEnabled: vi.fn(),
  countRiskScoreHistorySince: vi.fn(),
  refreshAllContractorRiskScores: vi.fn(),
  refreshContractorRiskScore: vi.fn(),
  createAuditLog: vi.fn(),
  generateRequestId: vi.fn(),
  createRequestLogger: vi.fn(),
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

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth", () => ({
  assertOrigin: mocks.assertOrigin,
  checkPermission: mocks.checkPermission,
}));

vi.mock("@/lib/tenant/context", () => ({
  requireAuthenticatedContextReadOnly: mocks.requireAuthenticatedContextReadOnly,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkAdminMutationRateLimit: mocks.checkAdminMutationRateLimit,
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: mocks.isFeatureEnabled,
}));

vi.mock("@/lib/plans", () => ({
  EntitlementDeniedError: mocks.EntitlementDeniedError,
  assertCompanyFeatureEnabled: mocks.assertCompanyFeatureEnabled,
}));

vi.mock("@/lib/repository/risk-passport.repository", () => ({
  countRiskScoreHistorySince: mocks.countRiskScoreHistorySince,
  refreshAllContractorRiskScores: mocks.refreshAllContractorRiskScores,
  refreshContractorRiskScore: mocks.refreshContractorRiskScore,
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

import {
  refreshAllRiskScoresAction,
  refreshSingleRiskScoreAction,
} from "./actions";

describe("risk passport actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAX_RISK_SCORE_RECALC_JOBS_PER_DAY = "300";

    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.checkPermission.mockResolvedValue({ success: true });
    mocks.requireAuthenticatedContextReadOnly.mockResolvedValue({
      companyId: "company-1",
      userId: "user-1",
    });
    mocks.checkAdminMutationRateLimit.mockResolvedValue({ success: true });
    mocks.isFeatureEnabled.mockReturnValue(true);
    mocks.assertCompanyFeatureEnabled.mockResolvedValue({});
    mocks.countRiskScoreHistorySince.mockResolvedValue(5);
    mocks.refreshAllContractorRiskScores.mockResolvedValue([
      { id: "score-1" },
      { id: "score-2" },
    ]);
    mocks.refreshContractorRiskScore.mockResolvedValue({
      id: "score-1",
      contractor_id: "ctr-1",
      site_id: "site-1",
      current_score: 42,
      threshold_state: "MEDIUM",
    });
    mocks.createAuditLog.mockResolvedValue({});
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.createRequestLogger.mockReturnValue(mocks.logger);
  });

  it("refreshes all scores and redirects success", async () => {
    const formData = new FormData();
    formData.set("siteId", "cm0000000000000000000001");

    await expect(refreshAllRiskScoresAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/risk-passport?status=ok&message=Refreshed+2+contractor+risk+scores",
    );
    expect(mocks.refreshAllContractorRiskScores).toHaveBeenCalledWith(
      "company-1",
      "cm0000000000000000000001",
      295,
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "risk.passport.refresh_all",
      }),
    );
  });

  it("blocks refresh when daily quota is exhausted", async () => {
    mocks.countRiskScoreHistorySince.mockResolvedValue(300);

    const formData = new FormData();
    await expect(refreshAllRiskScoresAction(formData)).rejects.toThrow(
      "CONTROL_ID%3A+RISK-001",
    );
    expect(mocks.refreshAllContractorRiskScores).not.toHaveBeenCalled();
  });

  it("refreshes single score and writes audit entry", async () => {
    const formData = new FormData();
    formData.set("contractorId", "cm0000000000000000000099");
    formData.set("siteId", "cm0000000000000000000001");

    await expect(refreshSingleRiskScoreAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/risk-passport?status=ok&message=Contractor+risk+score+refreshed",
    );
    expect(mocks.refreshContractorRiskScore).toHaveBeenCalledWith("company-1", {
      contractor_id: "cm0000000000000000000099",
      site_id: "cm0000000000000000000001",
    });
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "risk.passport.refresh",
      }),
    );
  });
});
