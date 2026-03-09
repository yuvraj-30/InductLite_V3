import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/repository/visitor-approval.repository.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("../visitor-approval.repository");
    expect(mod).toBeDefined();
  });
});
