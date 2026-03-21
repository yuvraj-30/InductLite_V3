import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claimNextQueuedExportJob: vi.fn(),
  countRunningExportJobs: vi.fn(),
  failQueuedExportJobsExceedingAgeLimit: vi.fn(),
  getExportOffPeakDecision: vi.fn(),
  markExportJobFailed: vi.fn(),
  markExportJobSucceeded: vi.fn(),
  requeueExportJob: vi.fn(),
  requeueStaleExportJobs: vi.fn(),
  findUserById: vi.fn(),
  createSystemAuditLog: vi.fn(),
  isFeatureEnabled: vi.fn(),
  hasPermission: vi.fn(),
  isOffPeakNow: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/export/worker", () => ({
  generateSignInCsvForCompany: vi.fn(),
  generateInductionCsvForCompany: vi.fn(),
  generateContractorCsvForCompany: vi.fn(),
  generateSitePackPdfForCompany: vi.fn(),
  generateComplianceZipForCompany: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  writeExportFile: vi.fn(),
}));

vi.mock("@/lib/repository/export.repository", () => ({
  claimNextQueuedExportJob: mocks.claimNextQueuedExportJob,
  countRunningExportJobs: mocks.countRunningExportJobs,
  failQueuedExportJobsExceedingAgeLimit: mocks.failQueuedExportJobsExceedingAgeLimit,
  getExportOffPeakDecision: mocks.getExportOffPeakDecision,
  markExportJobFailed: mocks.markExportJobFailed,
  markExportJobSucceeded: mocks.markExportJobSucceeded,
  requeueExportJob: mocks.requeueExportJob,
  requeueStaleExportJobs: mocks.requeueStaleExportJobs,
}));

vi.mock("@/lib/repository/user.repository", () => ({
  findUserById: mocks.findUserById,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createSystemAuditLog: mocks.createSystemAuditLog,
}));

vi.mock("@/lib/repository/evidence.repository", () => ({
  computeEvidenceHashRoot: vi.fn(),
  createEvidenceArtifact: vi.fn(),
  createEvidenceManifest: vi.fn(),
  sha256Hex: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: mocks.isFeatureEnabled,
}));

vi.mock("@/lib/auth/guards", () => ({
  hasPermission: mocks.hasPermission,
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

vi.mock("@/lib/logger", () => ({
  createRequestLogger: () => mocks.logger,
}));

vi.mock("@/lib/auth/csrf", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/csrf")>(
    "@/lib/auth/csrf",
  );
  return {
    ...actual,
    generateRequestId: vi.fn().mockReturnValue("req-export-runner"),
  };
});

vi.mock("@/lib/plans", () => ({
  EntitlementDeniedError: class EntitlementDeniedError extends Error {},
  assertCompanyFeatureEnabled: vi.fn(),
}));

import { processNextExportJob } from "./runner";

describe("processNextExportJob auto-offpeak guardrail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isFeatureEnabled.mockReturnValue(true);
    mocks.requeueStaleExportJobs.mockResolvedValue(0);
    mocks.failQueuedExportJobsExceedingAgeLimit.mockResolvedValue([]);
    mocks.claimNextQueuedExportJob.mockResolvedValue({
      id: "job-1",
      company_id: "company-1",
      requested_by: "user-1",
      export_type: "SIGN_IN_CSV",
      parameters: {},
      attempts: 0,
    });
    mocks.findUserById.mockResolvedValue({ id: "user-1", is_active: true, role: "ADMIN" });
    mocks.hasPermission.mockReturnValue(true);
    mocks.countRunningExportJobs.mockResolvedValue(1);
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
    mocks.isOffPeakNow.mockReturnValue(false);
    mocks.requeueExportJob.mockResolvedValue(undefined);
    mocks.createSystemAuditLog.mockResolvedValue(undefined);
  });

  it("requeues claimed exports and emits audit evidence when auto-offpeak is active", async () => {
    const result = await processNextExportJob();

    expect(result).toBeNull();
    expect(mocks.requeueExportJob).toHaveBeenCalledWith(
      "company-1",
      "job-1",
      60 * 60 * 1000,
    );
    expect(mocks.createSystemAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "company-1",
        action: "export.denied",
        entity_id: "job-1",
        details: expect.objectContaining({
          reason: "offpeak_auto_enabled",
          delayed_percent: 25,
          threshold_percent: 20,
          actor: "system",
        }),
      }),
    );
    expect(mocks.markExportJobSucceeded).not.toHaveBeenCalled();
  });
});
