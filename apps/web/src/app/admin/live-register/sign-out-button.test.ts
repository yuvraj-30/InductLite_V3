import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/live-register/sign-out-button.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./sign-out-button");
    expect(mod).toBeDefined();
  });
});
