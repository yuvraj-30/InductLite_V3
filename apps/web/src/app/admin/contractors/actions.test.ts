import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/contractors/actions.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./actions");
    expect(mod).toBeDefined();
  });
});
