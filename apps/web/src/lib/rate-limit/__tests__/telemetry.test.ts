import { describe, it, expect, beforeEach } from "vitest";
import { resetTelemetry, getBlockedCount } from "@/lib/rate-limit/telemetry";
import { checkLoginRateLimit } from "@/lib/rate-limit";

beforeEach(() => {
  resetTelemetry();
});

describe("rate-limit telemetry", () => {
  it("records blocked login events", async () => {
    const email = "telemetry@example.com";
    // exceed the login limit
    for (let i = 0; i < 6; i++) {
      await checkLoginRateLimit(email, { clientKey: "ua:telemetry" });
    }

    expect(getBlockedCount("login")).toBeGreaterThanOrEqual(1);
  });
});
