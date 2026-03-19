import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockLimit } = vi.hoisted(() => ({
  mockLimit: vi.fn(),
}));

vi.mock("@upstash/ratelimit", () => {
  class MockRatelimit {
    static slidingWindow = vi.fn();
    limit = mockLimit;
  }

  return { Ratelimit: MockRatelimit };
});

vi.mock("../client", () => ({
  getRedisClient: vi.fn(() => ({})),
}));

describe("Redis limiter outage handling", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      ALLOW_TEST_RUNNER: "0",
      RL_PUBLIC_SLUG_PER_IP_PER_MIN: "10",
    };
    mockLimit.mockReset();
    mockLimit.mockRejectedValue(new Error("upstash unavailable"));
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it("fails closed in production when the public slug redis limiter throws", async () => {
    const rateLimit = await import("../index");
    await rateLimit.__test_clearInMemoryStoreForClient("fallback-client");

    const first = await rateLimit.checkPublicSlugRateLimit("site-a", {
      clientKey: "fallback-client",
    });

    expect(first.success).toBe(false);
    expect(first.limit).toBe(10);
    expect(first.remaining).toBe(0);
    expect(mockLimit).toHaveBeenCalled();
  });

  it("fails closed in production when the public sign-in redis limiter throws", async () => {
    process.env.RL_SIGNIN_PER_IP_PER_MIN = "12";
    process.env.RL_SIGNIN_PER_SITE_PER_MIN = "30";

    const rateLimit = await import("../index");
    await rateLimit.__test_clearInMemoryStoreForClient("fallback-signin");

    const result = await rateLimit.checkSignInRateLimit("site-a", {
      clientKey: "fallback-signin",
    });

    expect(result.success).toBe(false);
    expect(result.limit).toBe(12);
    expect(result.remaining).toBe(0);
    expect(mockLimit).toHaveBeenCalled();
  });
});
