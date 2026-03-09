import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/differentiation/benchmark.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./benchmark");
    expect(mod).toBeDefined();
  });
});
