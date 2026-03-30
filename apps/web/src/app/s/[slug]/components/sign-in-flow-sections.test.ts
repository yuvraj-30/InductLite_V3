import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/s/[slug]/components/sign-in-flow-sections.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./sign-in-flow-sections");
    expect(mod).toBeDefined();
  });
});
