import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/(auth)/change-password/change-password-form.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./change-password-form");
    expect(mod).toBeDefined();
  });
});
