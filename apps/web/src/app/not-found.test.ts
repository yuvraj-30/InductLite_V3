import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/not-found.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./not-found");
    expect(mod).toBeDefined();
  });
});
