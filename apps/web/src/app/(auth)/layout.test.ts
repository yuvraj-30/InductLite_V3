import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/(auth)/layout.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./layout");
    expect(mod).toBeDefined();
  });
});
