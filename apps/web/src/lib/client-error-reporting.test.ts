import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/client-error-reporting.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./client-error-reporting");
    expect(mod).toBeDefined();
  });
});
