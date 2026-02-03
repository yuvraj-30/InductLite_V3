import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  resetTelemetry,
  recordRateLimitBlocked,
  getBlockedCount,
} from "@/lib/rate-limit/telemetry";

beforeEach(() => {
  resetTelemetry();
  vi.restoreAllMocks();
});

describe("telemetry HTTP integration", () => {
  it("sends telemetry to configured endpoint", async () => {
    process.env.RATE_LIMIT_TELEMETRY_URL = "https://example.com/telemetry";

    const mockFetch = vi.fn(async () => ({ status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    recordRateLimitBlocked({
      kind: "login",
      clientKey: "ua:abc",
      meta: { sample: true },
    });

    // microtask queue: give a tick for the fire-and-forget fetch to be called
    await new Promise((r) => setTimeout(r, 0));

    expect(getBlockedCount("login")).toBe(1);
    expect(mockFetch).toHaveBeenCalledWith("https://example.com/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: expect.any(String),
    });

    delete process.env.RATE_LIMIT_TELEMETRY_URL;
  });
});
