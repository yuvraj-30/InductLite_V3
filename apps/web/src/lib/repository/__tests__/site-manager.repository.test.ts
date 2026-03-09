import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/repository/site-manager.repository.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("../site-manager.repository");
    expect(mod).toBeDefined();
  });
});
