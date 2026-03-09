import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/components/ui/theme-preference.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./theme-preference");
    expect(mod).toBeDefined();
  });
});
