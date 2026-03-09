import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/repository/magic-link.repository.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("../magic-link.repository");
    expect(mod).toBeDefined();
  });
});
