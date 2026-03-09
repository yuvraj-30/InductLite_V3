import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/proxy.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./proxy");
    expect(mod).toBeDefined();
  });
});
