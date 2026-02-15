import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditDeleteMany: vi.fn(),
  exportFindMany: vi.fn(),
  contractorDocFindMany: vi.fn(),
  companyFindMany: vi.fn(),
  signInDeleteMany: vi.fn(),
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
    mocks.companyFindMany.mockResolvedValue([
      { id: "company-30", retention_days: 30 },
      { id: "company-default", retention_days: 0 },
    ]);
  });

  it("applies per-company sign-in retention cutoffs", async () => {
    await runRetentionTasks();

    expect(mocks.signInDeleteMany).toHaveBeenCalledTimes(2);

    const calls = mocks.signInDeleteMany.mock.calls.map(
      (args) =>
        args[0] as { where: { company_id: string; sign_out_ts: { lt: Date } } },
    );

    const company30 = calls.find(
      (call) => call.where.company_id === "company-30",
    );
    const companyDefault = calls.find(
      (call) => call.where.company_id === "company-default",
    );

    expect(company30).toBeDefined();
    expect(companyDefault).toBeDefined();

    const cutoff30 = company30?.where.sign_out_ts.lt.getTime() ?? 0;
    const cutoffDefault = companyDefault?.where.sign_out_ts.lt.getTime() ?? 0;
    const dayMs = 24 * 60 * 60 * 1000;

    // 365-day cutoff should be much older than 30-day cutoff.
    expect(cutoff30 - cutoffDefault).toBeGreaterThan(300 * dayMs);
  });
});
