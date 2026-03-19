import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  checkPermissionReadOnly: vi.fn(),
  findExportJobById: vi.fn(),
  checkExportDownloadGuardrails: vi.fn(),
  createAuditLog: vi.fn(),
  getSignedDownloadUrl: vi.fn(),
  generateRequestId: vi.fn(),
  readFile: vi.fn(),
  enforceBudgetPath: vi.fn(),
  startBudgetTrackedOperation: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  checkPermissionReadOnly: mocks.checkPermissionReadOnly,
}));

vi.mock("@/lib/repository/export.repository", () => ({
  findExportJobById: mocks.findExportJobById,
  checkExportDownloadGuardrails: mocks.checkExportDownloadGuardrails,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/lib/storage", () => ({
  getSignedDownloadUrl: mocks.getSignedDownloadUrl,
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: mocks.generateRequestId,
}));

vi.mock("@/lib/cost/budget-service", () => ({
  enforceBudgetPath: mocks.enforceBudgetPath,
  startBudgetTrackedOperation: mocks.startBudgetTrackedOperation,
}));

vi.mock("fs/promises", () => ({
  default: { readFile: mocks.readFile },
  readFile: mocks.readFile,
}));

import { GET } from "./route";

describe("GET /api/exports/[id]/download", () => {
  const originalStorageMode = process.env.STORAGE_MODE;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STORAGE_MODE = "s3";

    mocks.checkPermissionReadOnly.mockResolvedValue({
      success: true,
      user: { companyId: "company-1", id: "user-1" },
    });
    mocks.findExportJobById.mockResolvedValue({
      id: "job-1",
      status: "SUCCEEDED",
      file_path: "exports/company-1/job-1.csv",
      file_name: "sign-ins.csv",
      file_size: 1024,
      expires_at: null,
      export_type: "SIGN_IN_CSV",
    });
    mocks.checkExportDownloadGuardrails.mockResolvedValue({ allowed: true });
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.getSignedDownloadUrl.mockResolvedValue("https://signed.example/export");
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

  afterEach(() => {
    if (originalStorageMode === undefined) {
      delete process.env.STORAGE_MODE;
      return;
    }
    process.env.STORAGE_MODE = originalStorageMode;
  });

  it("returns deterministic guardrail payload when tenant download cap is exceeded", async () => {
    mocks.checkExportDownloadGuardrails.mockResolvedValue({
      allowed: false,
      controlId: "EXPT-003",
      violatedLimit:
        "MAX_EXPORT_DOWNLOAD_BYTES_PER_COMPANY_PER_DAY=536870912",
      scope: "tenant",
      message: "Daily company export download limit reached.",
    });

    const res = await GET(new Request("http://localhost/api/exports/job-1/download"), {
      params: Promise.resolve({ id: "job-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body).toMatchObject({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Daily company export download limit reached.",
        guardrail: {
          controlId: "EXPT-003",
          scope: "tenant",
          violatedLimit:
            "MAX_EXPORT_DOWNLOAD_BYTES_PER_COMPANY_PER_DAY=536870912",
        },
      },
    });
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
    expect(mocks.getSignedDownloadUrl).not.toHaveBeenCalled();
  });

  it("logs download bytes and redirects when guardrails allow the download", async () => {
    const res = await GET(new Request("http://localhost/api/exports/job-1/download"), {
      params: Promise.resolve({ id: "job-1" }),
    });

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://signed.example/export");
    expect(mocks.checkExportDownloadGuardrails).toHaveBeenCalledWith(
      "company-1",
      1024,
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "export.download",
        entity_type: "ExportJob",
        entity_id: "job-1",
        user_id: "user-1",
        request_id: "req-1",
        details: expect.objectContaining({
          export_type: "SIGN_IN_CSV",
          file_name: "sign-ins.csv",
          download_bytes: 1024,
        }),
      }),
    );
    expect(mocks.getSignedDownloadUrl).toHaveBeenCalledWith(
      "exports/company-1/job-1.csv",
      300,
    );
  });

  it("allows compliance export retrieval during budget protect", async () => {
    mocks.findExportJobById.mockResolvedValue({
      id: "job-1",
      status: "SUCCEEDED",
      file_path: "exports/company-1/job-1.zip",
      file_name: "compliance.zip",
      file_size: 2048,
      expires_at: null,
      export_type: "COMPLIANCE_ZIP",
    });

    await GET(new Request("http://localhost/api/exports/job-1/download"), {
      params: Promise.resolve({ id: "job-1" }),
    });

    expect(mocks.enforceBudgetPath).toHaveBeenCalledWith(
      "compliance.export.download",
    );
  });

  it("returns deterministic budget-protect payload for non-compliance export downloads", async () => {
    mocks.enforceBudgetPath.mockResolvedValue({
      allowed: false,
      controlId: "COST-008",
      violatedLimit: "PROJECTED_MONTHLY_SPEND_NZD<=150",
      scope: "environment",
      message:
        "This operation is disabled because the environment is in BUDGET_PROTECT mode",
      state: { budgetTier: "MVP" },
    });

    const res = await GET(new Request("http://localhost/api/exports/job-1/download"), {
      params: Promise.resolve({ id: "job-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error.guardrail).toMatchObject({
      controlId: "COST-008",
      scope: "environment",
      violatedLimit: "PROJECTED_MONTHLY_SPEND_NZD<=150",
    });
    expect(mocks.checkExportDownloadGuardrails).not.toHaveBeenCalled();
  });
});
