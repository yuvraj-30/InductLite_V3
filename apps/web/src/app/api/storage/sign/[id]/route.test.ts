import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fsReadFile: vi.fn(),
  getContractorSession: vi.fn(),
  generateRequestId: vi.fn(),
  createAuditLog: vi.fn(),
  findContractorDocumentForContractor: vi.fn(),
  getSignedDownloadUrl: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  default: {
    readFile: mocks.fsReadFile,
  },
}));

vi.mock("@/lib/auth/contractor-session", () => ({
  getContractorSession: mocks.getContractorSession,
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: mocks.generateRequestId,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/lib/repository/contractor.repository", () => ({
  findContractorDocumentForContractor: mocks.findContractorDocumentForContractor,
}));

vi.mock("@/lib/storage", () => ({
  getSignedDownloadUrl: mocks.getSignedDownloadUrl,
}));

import { GET } from "./route";

describe("GET /api/storage/sign/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getContractorSession.mockResolvedValue({
      companyId: "company-1",
      contractorId: "ctr-1",
    });
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.createAuditLog.mockResolvedValue({});
    mocks.findContractorDocumentForContractor.mockResolvedValue({
      id: "doc-1",
      expires_at: null,
      file_path: "tmp/doc-1.pdf",
      mime_type: "application/pdf",
      file_name: "doc-1.pdf",
    });
    mocks.fsReadFile.mockResolvedValue(Buffer.from("file-bytes"));
    mocks.getSignedDownloadUrl.mockResolvedValue("https://files.example.test/doc-1");
    process.env.STORAGE_MODE = "local";
  });

  it("returns 401 when contractor session is missing", async () => {
    mocks.getContractorSession.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns file bytes in local storage mode", async () => {
    process.env.STORAGE_MODE = "local";

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "doc-1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(mocks.fsReadFile).toHaveBeenCalledWith("tmp/doc-1.pdf");
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1);
  });

  it("redirects to signed URL in non-local storage mode", async () => {
    process.env.STORAGE_MODE = "s3";

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "doc-1" }),
    });

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://files.example.test/doc-1");
    expect(mocks.getSignedDownloadUrl).toHaveBeenCalledWith("tmp/doc-1.pdf", 300);
  });
});
