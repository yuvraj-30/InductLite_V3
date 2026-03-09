import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/sites/new/create-site-form.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./create-site-form");
    expect(mod).toBeDefined();
  });
});
