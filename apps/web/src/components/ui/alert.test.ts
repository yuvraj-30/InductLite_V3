import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/components/ui/alert.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./alert");
    expect(mod).toBeDefined();
  });
});
