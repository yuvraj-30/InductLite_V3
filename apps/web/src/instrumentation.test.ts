import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/instrumentation.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./instrumentation");
    expect(mod).toBeDefined();
  });
});
