import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/storage/keys.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./keys");
    expect(mod).toBeDefined();
  });
});
