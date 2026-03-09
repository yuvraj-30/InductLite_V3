import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/security/data-protection.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./data-protection");
    expect(mod).toBeDefined();
  });
});
