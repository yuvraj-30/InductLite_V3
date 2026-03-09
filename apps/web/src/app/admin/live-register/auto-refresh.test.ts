import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/live-register/auto-refresh.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./auto-refresh");
    expect(mod).toBeDefined();
  });
});
