import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/identity/user-sync.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./user-sync");
    expect(mod).toBeDefined();
  });
});
