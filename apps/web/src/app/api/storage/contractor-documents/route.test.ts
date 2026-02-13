import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/auth", () => ({
  checkPermission: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/auth/csrf", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/csrf")>(
    "@/lib/auth/csrf",
  );
  return {
    ...actual,
    assertOrigin: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/lib/tenant", () => ({
  requireAuthenticatedContextReadOnly: vi
    .fn()
    .mockResolvedValue({ companyId: "company-1", userId: "user-1" }),
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/storage", () => ({
  getSignedUploadUrl: vi.fn().mockResolvedValue("https://signed-upload"),
}));

vi.mock("@/lib/repository/contractor.repository", () => ({
  addContractorDocument: vi.fn().mockResolvedValue({ id: "doc-1" }),
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { POST as presignPost } from "./presign/route";
import { POST as commitPost } from "./commit/route";
import { isFeatureEnabled } from "@/lib/feature-flags";

describe("Contractor document upload guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isFeatureEnabled).mockReturnValue(true);
  });

  it("rejects unsupported mime types during presign", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://localhost",
        host: "localhost",
      },
      body: JSON.stringify({
        contractorId: "contractor-1",
        fileName: "malware.exe",
        mimeType: "application/x-msdownload",
        fileSize: 1024,
      }),
    });

    const res = await presignPost(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Unsupported file type");
  });

  it("rejects files larger than MAX_UPLOAD_MB during presign", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://localhost",
        host: "localhost",
      },
      body: JSON.stringify({
        contractorId: "contractor-1",
        fileName: "large.pdf",
        mimeType: "pdf",
        fileSize: 6 * 1024 * 1024,
      }),
    });

    const res = await presignPost(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("File exceeds");
  });

  it("rejects commit when uploads are disabled", async () => {
    vi.mocked(isFeatureEnabled as Mock).mockReturnValue(false);

    const req = new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://localhost",
        host: "localhost",
      },
      body: JSON.stringify({
        contractorId: "contractor-1",
        key: "contractors/company-1/contractor-1/doc-1.pdf",
        fileName: "doc.pdf",
        mimeType: "pdf",
        fileSize: 1024,
        documentType: "INSURANCE",
      }),
    });

    const res = await commitPost(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("Uploads are currently disabled");
  });
});
