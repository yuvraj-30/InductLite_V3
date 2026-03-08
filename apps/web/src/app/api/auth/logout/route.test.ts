import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertOrigin: vi.fn(),
  logout: vi.fn(),
  getClientIp: vi.fn(),
  getUserAgent: vi.fn(),
  generateRequestId: vi.fn(),
  createRequestLogger: vi.fn(),
  buildPublicUrl: vi.fn(),
  logger: { error: vi.fn() },
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertOrigin: mocks.assertOrigin,
  getClientIp: mocks.getClientIp,
  getUserAgent: mocks.getUserAgent,
  generateRequestId: mocks.generateRequestId,
}));

vi.mock("@/lib/auth", () => ({
  logout: mocks.logout,
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

vi.mock("@/lib/url/public-url", () => ({
  buildPublicUrl: mocks.buildPublicUrl,
}));

import { POST } from "./route";

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.getClientIp.mockResolvedValue("127.0.0.1");
    mocks.getUserAgent.mockResolvedValue("test-agent");
    mocks.logout.mockResolvedValue(undefined);
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.createRequestLogger.mockReturnValue(mocks.logger);
    mocks.buildPublicUrl.mockReturnValue("http://localhost/login");
  });

  it("returns 403 when origin validation fails", async () => {
    mocks.assertOrigin.mockRejectedValue(new Error("Invalid origin"));

    const res = await POST(new Request("http://localhost/api/auth/logout"));

    expect(res.status).toBe(403);
    expect(await res.text()).toBe("CSRF Blocked");
  });

  it("redirects to login even when logout throws", async () => {
    mocks.logout.mockRejectedValue(new Error("logout failed"));

    const res = await POST(new Request("http://localhost/api/auth/logout"));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost/login");
    expect(mocks.logger.error).toHaveBeenCalledTimes(1);
  });

  it("calls logout with client metadata and redirects", async () => {
    const res = await POST(new Request("http://localhost/api/auth/logout"));

    expect(mocks.logout).toHaveBeenCalledWith("127.0.0.1", "test-agent");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost/login");
  });
});
