import { describe, expect, it } from "vitest";

describe("smoke: apps/mobile/src/services/mobileApi.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./mobileApi");
    expect(mod).toBeDefined();
  });
});
