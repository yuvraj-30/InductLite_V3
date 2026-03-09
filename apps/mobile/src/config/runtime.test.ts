import { describe, expect, it } from "vitest";

describe("smoke: apps/mobile/src/config/runtime.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./runtime");
    expect(mod).toBeDefined();
  });
});
