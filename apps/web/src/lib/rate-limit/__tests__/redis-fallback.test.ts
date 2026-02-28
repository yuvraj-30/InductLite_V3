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

describe("Redis limiter fallback", () => {
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

  it("falls back to in-memory when public slug redis limiter throws", async () => {
    const rateLimit = await import("../index");
    await rateLimit.__test_clearInMemoryStoreForClient("fallback-client");

    const first = await rateLimit.checkPublicSlugRateLimit("site-a", {
      clientKey: "fallback-client",
    });
    const second = await rateLimit.checkPublicSlugRateLimit("site-a", {
      clientKey: "fallback-client",
    });

    expect(first.success).toBe(true);
    expect(first.limit).toBe(10);
    expect(first.remaining).toBe(9);
    expect(second.success).toBe(true);
    expect(second.remaining).toBe(8);
    expect(mockLimit).toHaveBeenCalled();
  });
});
