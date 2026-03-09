import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/components/ui/theme-switcher.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./theme-switcher");
    expect(mod).toBeDefined();
  });
});
