import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertOrigin: vi.fn(),
  checkAuthReadOnly: vi.fn(),
  generateRequestId: vi.fn(),
  getClientIp: vi.fn(),
  getUserAgent: vi.fn(),
  createRequestLogger: vi.fn(),
  createAuditLog: vi.fn(),
  findSiteByPublicSlug: vi.fn(),
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  assertOrigin: mocks.assertOrigin,
  checkAuthReadOnly: mocks.checkAuthReadOnly,
  generateRequestId: mocks.generateRequestId,
  getClientIp: mocks.getClientIp,
  getUserAgent: mocks.getUserAgent,
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/lib/repository/site.repository", () => ({
  findSiteByPublicSlug: mocks.findSiteByPublicSlug,
}));

import { POST } from "./route";

describe("POST /api/ux-events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.generateRequestId.mockReturnValue("req-ux-1");
    mocks.getClientIp.mockResolvedValue("127.0.0.1");
    mocks.getUserAgent.mockResolvedValue("Mozilla/5.0");
    mocks.createRequestLogger.mockReturnValue(mocks.logger);
    mocks.createAuditLog.mockResolvedValue({});
    mocks.findSiteByPublicSlug.mockResolvedValue({
      id: "site-1",
      company: { id: "company-1", name: "Acme" },
    });
    mocks.checkAuthReadOnly.mockResolvedValue({
      success: true,
      user: {
        id: "user-1",
        companyId: "company-1",
      },
    });
  });

  it("rejects invalid origins", async () => {
    mocks.assertOrigin.mockRejectedValue(new Error("invalid origin"));

    const response = await POST(
      new Request("http://localhost/api/ux-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: "ux.admin.nav_search",
          path: "/admin/sites",
          queryLength: 4,
          resultCount: 2,
          sectionCount: 1,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Invalid request origin");
  });

  it("rejects invalid payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/ux-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "ux.admin.nav_search" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid UX event payload");
  });

  it("records induction step transitions as audit events", async () => {
    const response = await POST(
      new Request("http://localhost/api/ux-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: "ux.induction.step_transition",
          slug: "site-slug",
          fromStep: "details",
          toStep: "induction",
          flowId: "flow-1",
          isKiosk: false,
        }),
      }),
    );

    expect(response.status).toBe(204);
    expect(mocks.findSiteByPublicSlug).toHaveBeenCalledWith("site-slug");
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "ux.induction.step_transition",
        entity_type: "Site",
        entity_id: "site-1",
        details: expect.objectContaining({
          site_slug: "site-slug",
          from_step: "details",
          to_step: "induction",
          flow_id: "flow-1",
        }),
      }),
    );
  });

  it("returns 404 for induction events with unknown site slug", async () => {
    mocks.findSiteByPublicSlug.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/ux-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: "ux.induction.step_transition",
          slug: "missing-slug",
          fromStep: "details",
          toStep: "induction",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Site not found");
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });

  it("requires auth for admin nav search events", async () => {
    mocks.checkAuthReadOnly.mockResolvedValue({
      success: false,
      code: "UNAUTHENTICATED",
      error: "Authentication required",
    });

    const response = await POST(
      new Request("http://localhost/api/ux-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: "ux.admin.nav_search",
          path: "/admin/sites",
          queryLength: 5,
          resultCount: 3,
          sectionCount: 2,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Authentication required");
  });

  it("records admin nav search UX events for authenticated users", async () => {
    const response = await POST(
      new Request("http://localhost/api/ux-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: "ux.admin.nav_search",
          path: "/admin/sites",
          queryLength: 5,
          resultCount: 3,
          sectionCount: 2,
        }),
      }),
    );

    expect(response.status).toBe(204);
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "ux.admin.nav_search",
        user_id: "user-1",
        details: expect.objectContaining({
          path: "/admin/sites",
          query_length: 5,
          result_count: 3,
          section_count: 2,
        }),
      }),
    );
  });
});
