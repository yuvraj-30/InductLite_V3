import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkPermissionReadOnly: vi.fn(),
  checkSitePermissionReadOnly: vi.fn(),
  generateRequestId: vi.fn(),
  createAuditLog: vi.fn(),
  findSignInIdentityEvidence: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  checkPermissionReadOnly: mocks.checkPermissionReadOnly,
  checkSitePermissionReadOnly: mocks.checkSitePermissionReadOnly,
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: mocks.generateRequestId,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/lib/repository/signin.repository", () => ({
  findSignInIdentityEvidence: mocks.findSignInIdentityEvidence,
}));

import { GET } from "./route";

describe("GET /api/sign-ins/[id]/identity-evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkPermissionReadOnly.mockResolvedValue({
      success: true,
      user: { companyId: "company-1", id: "user-1" },
    });
    mocks.checkSitePermissionReadOnly.mockResolvedValue({
      success: true,
      user: { id: "user-1" },
    });
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.createAuditLog.mockResolvedValue({});
    mocks.findSignInIdentityEvidence.mockResolvedValue({
      signInId: "sign-1",
      siteId: "site-1",
      visitorName: "Ari",
      visitorPhotoEvidence: "data:image/jpeg;base64,photo",
      visitorIdEvidence: "data:image/jpeg;base64,id",
      visitorIdEvidenceType: "DRIVER_LICENSE",
    });
  });

  it("returns 401/403 payload when permission guard fails", async () => {
    mocks.checkPermissionReadOnly.mockResolvedValue({
      success: false,
      code: "UNAUTHENTICATED",
      error: "Authentication required",
    });
    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "sign-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when evidence record is missing", async () => {
    mocks.findSignInIdentityEvidence.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "sign-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Identity evidence not found");
  });

  it("returns evidence payload and writes audit log", async () => {
    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "sign-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.signInId).toBe("sign-1");
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1);
  });
});
