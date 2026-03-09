import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/demo/demo-booking-form.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./demo-booking-form");
    expect(mod).toBeDefined();
  });
});
