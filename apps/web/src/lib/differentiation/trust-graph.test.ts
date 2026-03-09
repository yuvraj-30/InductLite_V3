import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/differentiation/trust-graph.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./trust-graph");
    expect(mod).toBeDefined();
  });
});
