import { describe, expect, it } from "vitest";

describe("smoke: packages/shared/src/schemas.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./schemas");
    expect(mod).toBeDefined();
  });
});
