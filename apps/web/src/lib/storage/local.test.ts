import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/storage/local.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./local");
    expect(mod).toBeDefined();
  });
});
