import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/history/history-filters.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./history-filters");
    expect(mod).toBeDefined();
  });
});
