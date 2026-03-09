import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/contractors/contractor-action-buttons.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./contractor-action-buttons");
    expect(mod).toBeDefined();
  });
});
