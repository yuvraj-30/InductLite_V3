import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/auth/contractor-session.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./contractor-session");
    expect(mod).toBeDefined();
  });
});
