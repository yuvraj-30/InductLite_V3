import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/s/[slug]/components/SignInFlow.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./SignInFlow");
    expect(mod).toBeDefined();
  });
});
