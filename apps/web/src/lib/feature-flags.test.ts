import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/feature-flags.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./feature-flags");
    expect(mod).toBeDefined();
  });
});
