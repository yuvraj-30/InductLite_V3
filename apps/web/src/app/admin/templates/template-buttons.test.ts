import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/templates/template-buttons.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./template-buttons");
    expect(mod).toBeDefined();
  });
});
