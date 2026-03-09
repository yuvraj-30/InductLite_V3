import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/repository/plan-entitlement.repository.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("../plan-entitlement.repository");
    expect(mod).toBeDefined();
  });
});
