import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/~offline/page.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./page");
    expect(mod).toBeDefined();
  });
});
