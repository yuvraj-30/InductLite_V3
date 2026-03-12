import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/loading.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./loading");
    expect(mod).toBeDefined();
  });
});
