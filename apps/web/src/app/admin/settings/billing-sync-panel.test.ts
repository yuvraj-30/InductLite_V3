import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/settings/billing-sync-panel.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./billing-sync-panel");
    expect(mod).toBeDefined();
  });
});
