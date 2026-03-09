import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/db/public-db.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./public-db");
    expect(mod).toBeDefined();
  });
});
