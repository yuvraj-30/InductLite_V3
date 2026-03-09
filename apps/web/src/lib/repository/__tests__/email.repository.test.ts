import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/repository/email.repository.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("../email.repository");
    expect(mod).toBeDefined();
  });
});
