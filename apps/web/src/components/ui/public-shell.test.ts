import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/components/ui/public-shell.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./public-shell");
    expect(mod).toBeDefined();
  });
});
