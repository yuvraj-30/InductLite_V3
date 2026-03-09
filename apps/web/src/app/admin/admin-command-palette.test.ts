import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/admin-command-palette.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./admin-command-palette");
    expect(mod).toBeDefined();
  });
});
