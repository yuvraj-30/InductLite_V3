import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/users/new/create-user-form.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./create-user-form");
    expect(mod).toBeDefined();
  });
});
