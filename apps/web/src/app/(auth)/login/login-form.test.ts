import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/(auth)/login/login-form.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./login-form");
    expect(mod).toBeDefined();
  });
});
