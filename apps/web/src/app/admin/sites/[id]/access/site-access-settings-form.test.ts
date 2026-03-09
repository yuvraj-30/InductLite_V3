import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/sites/[id]/access/site-access-settings-form.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./site-access-settings-form");
    expect(mod).toBeDefined();
  });
});
