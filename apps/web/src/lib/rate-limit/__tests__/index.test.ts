import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  checkPublicSlugRateLimit,
  checkLoginRateLimit,
} from "@/lib/rate-limit";

describe("rate-limit index", () => {
  const originalAllowTestRunner = process.env.ALLOW_TEST_RUNNER;

  beforeEach(() => {
    // Disable test runner bypass to test actual rate limiting behavior
    delete process.env.ALLOW_TEST_RUNNER;
  });

  afterEach(() => {
    // Restore original value
    if (originalAllowTestRunner !== undefined) {
      process.env.ALLOW_TEST_RUNNER = originalAllowTestRunner;
    } else {
      delete process.env.ALLOW_TEST_RUNNER;
    }
  });

  it("checkPublicSlugRateLimit respects provided clientKey and decrements remaining", async () => {
    const res1 = await checkPublicSlugRateLimit("myslug", {
      clientKey: "ua:test-client",
    });

    expect(res1.success).toBe(true);
    expect(res1.limit).toBe(10);
    expect(res1.remaining).toBe(9);

    const res2 = await checkPublicSlugRateLimit("myslug", {
      clientKey: "ua:test-client",
    });

    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(8);
  });

  it("checkLoginRateLimit blocks after 5 attempts per clientKey+email", async () => {
    const email = "rate@example.com";
    let last: any = null;

    for (let i = 0; i < 6; i++) {
      last = await checkLoginRateLimit(email, { clientKey: "ua:rl-client" });
    }

    expect(last.success).toBe(false);
    expect(last.limit).toBe(5);
  });
});
