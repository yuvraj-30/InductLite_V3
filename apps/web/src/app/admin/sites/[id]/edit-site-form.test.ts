import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/sites/[id]/edit-site-form.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./edit-site-form");
    expect(mod).toBeDefined();
  });
});
