import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/repository/demo-booking.repository.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("../demo-booking.repository");
    expect(mod).toBeDefined();
  });
});
