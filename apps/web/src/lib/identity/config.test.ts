import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/identity/config.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./config");
    expect(mod).toBeDefined();
  });
});
