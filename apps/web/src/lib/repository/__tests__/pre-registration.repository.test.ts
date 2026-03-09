import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/repository/pre-registration.repository.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("../pre-registration.repository");
    expect(mod).toBeDefined();
  });
});
