import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateRequestId: vi.fn(),
  authenticatePartnerApiRequest: vi.fn(),
  checkAdminMutationRateLimit: vi.fn(),
  scopedDb: vi.fn(),
  listSignInHistory: vi.fn(),
  createSystemAuditLog: vi.fn(),
  auditLogCount: vi.fn(),
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: mocks.generateRequestId,
}));

vi.mock("@/lib/partner-api/auth", () => ({
  authenticatePartnerApiRequest: mocks.authenticatePartnerApiRequest,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkAdminMutationRateLimit: mocks.checkAdminMutationRateLimit,
}));

vi.mock("@/lib/db/scoped-db", () => ({
  scopedDb: mocks.scopedDb,
}));

vi.mock("@/lib/repository/signin.repository", () => ({
  listSignInHistory: mocks.listSignInHistory,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createSystemAuditLog: mocks.createSystemAuditLog,
}));

import { GET } from "./route";

describe("GET /api/v1/partner/sign-ins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.authenticatePartnerApiRequest.mockResolvedValue({
      ok: true,
      context: {
        companyId: "company-1",
        tokenFingerprint: "fp-1",
        scope: "signins.read",
        monthlyQuota: 100,
      },
    });
    mocks.checkAdminMutationRateLimit.mockResolvedValue({
      success: true,
      limit: 120,
      remaining: 119,
      reset: 1700000000,
    });
    mocks.auditLogCount.mockResolvedValue(2);
    mocks.scopedDb.mockReturnValue({
      auditLog: {
        count: mocks.auditLogCount,
      },
    });
    mocks.listSignInHistory.mockResolvedValue({
      items: [
        {
          id: "sign-1",
          site_id: "cm0000000000000000000001",
          site: { name: "Alpha Site" },
          visitor_name: "Ari",
          visitor_phone: "+64211234567",
          visitor_email: "ari@example.test",
          employer_name: "Acme",
          visitor_type: "EMPLOYEE",
          sign_in_ts: new Date("2026-03-08T00:00:00.000Z"),
          sign_out_ts: null,
          notes: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });
    mocks.createSystemAuditLog.mockResolvedValue({});
  });

  it("returns auth response when request is unauthorized", async () => {
    mocks.authenticatePartnerApiRequest.mockResolvedValue({
      ok: false,
      response: Response.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      ),
    });

    const res = await GET(new Request("http://localhost/api/v1/partner/sign-ins"));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 400 for invalid query params", async () => {
    const res = await GET(
      new Request(
        "http://localhost/api/v1/partner/sign-ins?siteId=bad&page=0&pageSize=150",
      ),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("returns sign-in history and pagination payload", async () => {
    const res = await GET(
      new Request(
        "http://localhost/api/v1/partner/sign-ins?siteId=cm0000000000000000000001&page=1&pageSize=50",
      ),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
    expect(mocks.listSignInHistory).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        siteId: "cm0000000000000000000001",
      }),
      expect.objectContaining({
        page: 1,
        pageSize: 50,
      }),
    );
    expect(mocks.createSystemAuditLog).toHaveBeenCalledTimes(1);
  });
});
