import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditDeleteMany: vi.fn(),
  exportFindMany: vi.fn(),
  contractorDocFindMany: vi.fn(),
  companyFindMany: vi.fn(),
  signInDeleteMany: vi.fn(),
  incidentDeleteMany: vi.fn(),
  emergencyDrillDeleteMany: vi.fn(),
  deleteObject: vi.fn(),
  deleteExportJob: vi.fn(),
  deleteContractorDocumentById: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("@/lib/db/public-db", () => ({
  publicDb: {
    auditLog: {
      deleteMany: mocks.auditDeleteMany,
    },
    exportJob: {
      findMany: mocks.exportFindMany,
    },
    contractorDocument: {
      findMany: mocks.contractorDocFindMany,
    },
    company: {
      findMany: mocks.companyFindMany,
    },
    signInRecord: {
      deleteMany: mocks.signInDeleteMany,
    },
    incidentReport: {
      deleteMany: mocks.incidentDeleteMany,
    },
    emergencyDrill: {
      deleteMany: mocks.emergencyDrillDeleteMany,
    },
  },
}));

vi.mock("@/lib/storage", () => ({
  deleteObject: mocks.deleteObject,
}));

vi.mock("@/lib/repository/export.repository", () => ({
  deleteExportJob: mocks.deleteExportJob,
}));

vi.mock("@/lib/repository/contractor.repository", () => ({
  deleteContractorDocumentById: mocks.deleteContractorDocumentById,
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: () => ({
    info: mocks.logInfo,
    warn: mocks.logWarn,
  }),
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: () => "req-test",
}));

import { runRetentionTasks } from "./retention";

describe("runRetentionTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.auditDeleteMany.mockResolvedValue({ count: 0 });
    mocks.exportFindMany.mockResolvedValue([]);
    mocks.contractorDocFindMany.mockResolvedValue([]);
    mocks.signInDeleteMany.mockResolvedValue({ count: 0 });
    mocks.incidentDeleteMany.mockResolvedValue({ count: 0 });
    mocks.emergencyDrillDeleteMany.mockResolvedValue({ count: 0 });
    mocks.companyFindMany.mockResolvedValue([
      {
        id: "company-30",
        retention_days: 30,
        induction_retention_days: 30,
        audit_retention_days: 365,
        incident_retention_days: 1825,
        emergency_drill_retention_days: 1825,
        compliance_legal_hold: false,
      },
      {
        id: "company-default",
        retention_days: 0,
        induction_retention_days: 0,
        audit_retention_days: 0,
        incident_retention_days: 0,
        emergency_drill_retention_days: 0,
        compliance_legal_hold: false,
      },
    ]);
  });

  it("applies per-company sign-in and audit retention cutoffs", async () => {
    await runRetentionTasks();

    expect(mocks.signInDeleteMany).toHaveBeenCalledTimes(2);
    expect(mocks.auditDeleteMany).toHaveBeenCalledTimes(2);

    const signInCalls = mocks.signInDeleteMany.mock.calls.map(
      (args) =>
        args[0] as { where: { company_id: string; sign_out_ts: { lt: Date } } },
    );
    const auditCalls = mocks.auditDeleteMany.mock.calls.map(
      (args) =>
        args[0] as { where: { company_id: string; created_at: { lt: Date } } },
    );

    const company30 = signInCalls.find(
      (call) => call.where.company_id === "company-30",
    );
    const companyDefault = signInCalls.find(
      (call) => call.where.company_id === "company-default",
    );
    const company30Audit = auditCalls.find(
      (call) => call.where.company_id === "company-30",
    );
    const companyDefaultAudit = auditCalls.find(
      (call) => call.where.company_id === "company-default",
    );

    expect(company30).toBeDefined();
    expect(companyDefault).toBeDefined();
    expect(company30Audit).toBeDefined();
    expect(companyDefaultAudit).toBeDefined();

    const cutoff30 = company30?.where.sign_out_ts.lt.getTime() ?? 0;
    const cutoffDefault = companyDefault?.where.sign_out_ts.lt.getTime() ?? 0;
    const auditCutoff30 = company30Audit?.where.created_at.lt.getTime() ?? 0;
    const auditCutoffDefault =
      companyDefaultAudit?.where.created_at.lt.getTime() ?? 0;
    const dayMs = 24 * 60 * 60 * 1000;

    // 365-day cutoff should be much older than 30-day cutoff.
    expect(cutoff30 - cutoffDefault).toBeGreaterThan(300 * dayMs);
    // 365-day audit cutoff should be much older than default guardrail floor.
    expect(auditCutoffDefault - auditCutoff30).toBeGreaterThan(200 * dayMs);
  });

  it("skips sign-in, incident, drill, and audit purges when company compliance legal hold is active", async () => {
    mocks.companyFindMany.mockResolvedValue([
      {
        id: "company-hold",
        retention_days: 30,
        induction_retention_days: 365,
        audit_retention_days: 365,
        incident_retention_days: 1825,
        emergency_drill_retention_days: 1825,
        compliance_legal_hold: true,
      },
    ]);

    await runRetentionTasks();

    expect(mocks.signInDeleteMany).not.toHaveBeenCalled();
    expect(mocks.auditDeleteMany).not.toHaveBeenCalled();
    expect(mocks.incidentDeleteMany).not.toHaveBeenCalled();
    expect(mocks.emergencyDrillDeleteMany).not.toHaveBeenCalled();
  });
});
