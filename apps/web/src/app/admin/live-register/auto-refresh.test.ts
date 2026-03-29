import { describe, expect, it } from "vitest";
import { getRefreshCountdownSeconds } from "./auto-refresh";

describe("live-register auto refresh helpers", () => {
  it("normalizes the countdown to whole seconds with a one-second floor", () => {
    expect(getRefreshCountdownSeconds(30_000)).toBe(30);
    expect(getRefreshCountdownSeconds(1_500)).toBe(1);
    expect(getRefreshCountdownSeconds(250)).toBe(1);
  });

  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./auto-refresh");
    expect(mod).toBeDefined();
  });
});
