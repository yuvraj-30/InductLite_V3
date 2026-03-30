import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/settings/billing-preview-detail-disclosure.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./billing-preview-detail-disclosure");
    expect(mod).toBeDefined();
  });
});
