import { describe, expect, it } from "vitest";

describe("smoke: apps/mobile/src/storage/mobileSettings.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./mobileSettings");
    expect(mod).toBeDefined();
  });
});
