import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  assertOrigin: vi.fn(),
  logout: vi.fn(),
  getClientIp: vi.fn(),
  getUserAgent: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertOrigin: mocks.assertOrigin,
  generateRequestId: () => "req-1",
  getClientIp: mocks.getClientIp,
  getUserAgent: mocks.getUserAgent,
}));

vi.mock("@/lib/auth", () => ({
  logout: mocks.logout,
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: () => ({
    error: mocks.logError,
  }),
}));

vi.mock("@/lib/url/public-url", () => ({
  buildPublicUrl: (path: string) => new URL(path, "https://example.com"),
}));

import { POST } from "./route";

describe("auth/logout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClientIp.mockResolvedValue("127.0.0.1");
    mocks.getUserAgent.mockResolvedValue("vitest");
    mocks.logout.mockResolvedValue(undefined);
  });

  it("blocks POST when origin is invalid", async () => {
    mocks.assertOrigin.mockRejectedValue(new Error("Invalid request origin"));

    const response = await POST(
      new Request("https://example.com/logout", { method: "POST" }),
    );

    expect(response.status).toBe(403);
  });

  it("logs out and redirects when origin is valid", async () => {
    mocks.assertOrigin.mockResolvedValue(undefined);

    const response = await POST(
      new Request("https://example.com/logout", { method: "POST" }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://example.com/login");
    expect(mocks.logout).toHaveBeenCalledTimes(1);
  });
});
