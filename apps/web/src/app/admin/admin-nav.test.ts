import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/admin-nav.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./admin-nav");
    expect(mod).toBeDefined();
  });
});
