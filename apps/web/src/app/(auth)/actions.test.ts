import { vi, describe, it, expect, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mock rate-limit and auth modules
vi.mock("@/lib/rate-limit", () => ({
  checkLoginRateLimit: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  login: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
}));

// Mock next/navigation redirect so it doesn't throw during tests
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

// Mock CSRF helpers used by actions (getClientIp/getUserAgent) to avoid headers() call outside request scope
vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: () => "test-req-id",
  getClientIp: async () => "127.0.0.1",
  getUserAgent: async () => "test-agent",
}));

import { loginAction } from "./actions";
import { checkLoginRateLimit } from "@/lib/rate-limit";
import { login as sessionLogin } from "@/lib/auth";

describe("loginAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns throttled error when rate limited and does not call sessionLogin", async () => {
    (checkLoginRateLimit as unknown as Mock).mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Date.now() + 1000,
    });

    const formData = {
      get: (key: string) =>
        key === "email" ? "alice@example.com" : "password123",
    } as unknown as FormData;

    const result = await loginAction(null, formData);

    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/Too many login attempts/);
    expect(sessionLogin).not.toHaveBeenCalled();
  });

  it("calls sessionLogin and redirects when not rate limited", async () => {
    (checkLoginRateLimit as unknown as Mock).mockResolvedValue({
      success: true,
      remaining: 4,
      limit: 5,
      reset: Date.now() + 10000,
    });

    (sessionLogin as unknown as Mock).mockResolvedValue({ success: true });

    const formData = {
      get: (key: string) =>
        key === "email" ? "bob@example.com" : "password321",
    } as unknown as FormData;

    await loginAction(null, formData);

    // sessionLogin should have been called
    expect(sessionLogin).toHaveBeenCalled();

    // redirect should have been invoked to the dashboard
    const { redirect } = await import("next/navigation");
    expect((redirect as unknown as Mock).mock.calls.length).toBeGreaterThan(0);

    // Ensure checkLoginRateLimit was called with options that include requestId
    const limiterOptions = (checkLoginRateLimit as unknown as Mock).mock
      .calls[0]![1];
    expect(limiterOptions).toBeDefined();
    expect(typeof limiterOptions.requestId).toBe("string");
  });

  it("returns MFA required when sessionLogin requests it", async () => {
    (checkLoginRateLimit as unknown as Mock).mockResolvedValue({
      success: true,
      remaining: 4,
      limit: 5,
      reset: Date.now() + 10000,
    });

    (sessionLogin as unknown as Mock).mockResolvedValue({
      success: false,
      error: "MFA code required",
      requiresMfa: true,
    });

    const formData = {
      get: (key: string) =>
        key === "email" ? "mfa@example.com" : "password123",
    } as unknown as FormData;

    const result = await loginAction(null, formData);

    expect(result.success).toBe(false);
    expect((result as any).requiresMfa).toBe(true);
  });
});
