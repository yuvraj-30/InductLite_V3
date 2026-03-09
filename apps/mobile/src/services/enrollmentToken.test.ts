import { describe, expect, it } from "vitest";

describe("smoke: apps/mobile/src/services/enrollmentToken.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./enrollmentToken");
    expect(mod).toBeDefined();
  });
});
