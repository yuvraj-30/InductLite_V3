import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/sites/site-buttons.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./site-buttons");
    expect(mod).toBeDefined();
  });
});
