import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/users/user-action-buttons.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./user-action-buttons");
    expect(mod).toBeDefined();
  });
});
