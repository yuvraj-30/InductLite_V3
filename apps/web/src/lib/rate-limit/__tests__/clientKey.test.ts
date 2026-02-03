import { describe, it, expect } from "vitest";
import { getStableClientKey } from "@/lib/rate-limit/clientKey";

describe("getStableClientKey", () => {
  it("uses x-forwarded-for when trustProxy is true", () => {
    const headers = {
      "x-forwarded-for": "203.0.113.5, 198.51.100.23",
      "user-agent": "ua",
    };
    const key = getStableClientKey(headers, { trustProxy: true });
    expect(key).toBe("ip:203.0.113.5");
  });

  it("falls back to UA hash when trustProxy is false or no xff", () => {
    const headers = {
      "user-agent": "myagent 1.2",
      accept: "text/html",
    } as Record<string, string | undefined>;
    const key = getStableClientKey(headers, { trustProxy: false });
    expect(key.startsWith("ua:")).toBeTruthy();
    expect(key.length).toBeGreaterThan(3);
  });
});
