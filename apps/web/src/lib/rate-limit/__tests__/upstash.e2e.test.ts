import { describe, it, expect } from "vitest";
import { isRedisConfigured } from "@/lib/rate-limit/client";
import { checkLoginRateLimit } from "@/lib/rate-limit";

// This test runs only when UPSTASH env vars are present to avoid hitting network during normal tests
if (!isRedisConfigured()) {
  // Skip the whole file
  describe.skip("Upstash E2E (skipped - no UPSTASH config)", () => {
    it("skipped", () => {});
  });
} else {
  describe("Upstash E2E", () => {
    it("enforces login rate limiting via Upstash", async () => {
      const email = `e2e-${Date.now()}@example.com`;
      let last: any = null;
      for (let i = 0; i < 6; i++) {
        last = await checkLoginRateLimit(email, { clientKey: "ua:e2e" });
      }
      expect(last.success).toBe(false);
      expect(last.limit).toBe(5);
    });
  });
}
