import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/auth/session-config.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./session-config");
    expect(mod).toBeDefined();
  });
});
