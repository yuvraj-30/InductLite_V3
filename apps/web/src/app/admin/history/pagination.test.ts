import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/history/pagination.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./pagination");
    expect(mod).toBeDefined();
  });
});
