import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/users/[id]/edit-user-form.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./edit-user-form");
    expect(mod).toBeDefined();
  });
});
