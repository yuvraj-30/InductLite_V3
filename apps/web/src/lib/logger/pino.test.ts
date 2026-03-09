import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/logger/pino.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./pino");
    expect(mod).toBeDefined();
  });
});
