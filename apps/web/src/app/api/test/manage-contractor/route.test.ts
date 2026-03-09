import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/api/test/manage-contractor/route.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./route");
    expect(mod).toBeDefined();
  });
});
