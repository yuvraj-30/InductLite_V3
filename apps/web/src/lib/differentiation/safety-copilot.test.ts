import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/differentiation/safety-copilot.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./safety-copilot");
    expect(mod).toBeDefined();
  });
});
