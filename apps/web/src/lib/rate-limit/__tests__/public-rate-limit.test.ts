import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Public rate-limit guardrails", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      ALLOW_TEST_RUNNER: "0",
      RL_PUBLIC_SLUG_PER_IP_PER_MIN: "2",
      RL_SIGNIN_PER_IP_PER_MIN: "2",
      RL_SIGNIN_PER_SITE_PER_MIN: "2",
      RL_SIGNOUT_PER_IP_PER_MIN: "2",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("enforces public slug rate limit", async () => {
    const rateLimit = await import("../index");
    await rateLimit.__test_clearInMemoryStoreForClient("client-1");

    const first = await rateLimit.checkPublicSlugRateLimit("site-a", {
      clientKey: "client-1",
    });
    const second = await rateLimit.checkPublicSlugRateLimit("site-a", {
      clientKey: "client-1",
    });
    const third = await rateLimit.checkPublicSlugRateLimit("site-a", {
      clientKey: "client-1",
    });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(third.success).toBe(false);
  });

  it("enforces sign-in rate limit", async () => {
    const rateLimit = await import("../index");
    await rateLimit.__test_clearInMemoryStoreForClient("client-2");

    const first = await rateLimit.checkSignInRateLimit("site-a", {
      clientKey: "client-2",
    });
    const second = await rateLimit.checkSignInRateLimit("site-a", {
      clientKey: "client-2",
    });
    const third = await rateLimit.checkSignInRateLimit("site-a", {
      clientKey: "client-2",
    });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(third.success).toBe(false);
  });

  it("enforces sign-out rate limit", async () => {
    const rateLimit = await import("../index");
    await rateLimit.__test_clearInMemoryStoreForClient("client-3");

    const first = await rateLimit.checkSignOutRateLimit("token-1", {
      clientKey: "client-3",
    });
    const second = await rateLimit.checkSignOutRateLimit("token-1", {
      clientKey: "client-3",
    });
    const third = await rateLimit.checkSignOutRateLimit("token-1", {
      clientKey: "client-3",
    });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(third.success).toBe(false);
  });
});
