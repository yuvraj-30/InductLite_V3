import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/sign-out/components/SignOutForm.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./SignOutForm");
    expect(mod).toBeDefined();
  });
});
