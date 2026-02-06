import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("rate-limit guardrail defaults", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.RL_PUBLIC_SLUG_PER_IP_PER_MIN = "30";
    process.env.RL_SIGNIN_PER_IP_PER_MIN = "30";
    process.env.RL_SIGNIN_PER_SITE_PER_MIN = "200";
    process.env.RL_SIGNOUT_PER_IP_PER_MIN = "30";
    delete process.env.ALLOW_TEST_RUNNER;
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses guardrail thresholds for public and sign-in limits", async () => {
    const {
      checkPublicSlugRateLimit,
      checkSignInRateLimit,
      checkSignOutRateLimit,
    } = await import("@/lib/rate-limit");

    const publicRes = await checkPublicSlugRateLimit("slug", {
      clientKey: "ua:test",
    });
    expect(publicRes.limit).toBe(30);

    const signInRes = await checkSignInRateLimit("site", {
      clientKey: "ua:test",
    });
    expect(signInRes.limit).toBe(30);

    const signOutRes = await checkSignOutRateLimit("tok", {
      clientKey: "ua:test",
    });
    expect(signOutRes.limit).toBe(30);
  });
});
