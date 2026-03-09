import { describe, expect, it } from "vitest";

describe("smoke: packages/shared/src/utils.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./utils");
    expect(mod).toBeDefined();
  });
});
