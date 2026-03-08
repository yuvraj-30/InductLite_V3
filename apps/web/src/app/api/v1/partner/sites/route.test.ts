import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateRequestId: vi.fn(),
  authenticatePartnerApiRequest: vi.fn(),
  checkAdminMutationRateLimit: vi.fn(),
  scopedDb: vi.fn(),
  findAllSites: vi.fn(),
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

vi.mock("@/lib/repository/site.repository", () => ({
  findAllSites: mocks.findAllSites,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createSystemAuditLog: mocks.createSystemAuditLog,
}));

import { GET } from "./route";

describe("GET /api/v1/partner/sites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.authenticatePartnerApiRequest.mockResolvedValue({
      ok: true,
      context: {
        companyId: "company-1",
        tokenFingerprint: "fp-1",
        scope: "sites.read",
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
    mocks.findAllSites.mockResolvedValue([
      {
        id: "cm0000000000000000000001",
        name: "Alpha Site",
        address: "Auckland",
        description: "Main site",
        is_active: true,
      },
    ]);
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

    const res = await GET(new Request("http://localhost/api/v1/partner/sites"));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns quota error when monthly quota is exhausted", async () => {
    mocks.auditLogCount.mockResolvedValue(100);

    const res = await GET(new Request("http://localhost/api/v1/partner/sites"));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.error).toContain("monthly quota exceeded");
  });

  it("returns site list and quota stats", async () => {
    const res = await GET(new Request("http://localhost/api/v1/partner/sites"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("Alpha Site");
    expect(body.quota.used).toBe(3);
    expect(mocks.createSystemAuditLog).toHaveBeenCalledTimes(1);
  });
});
