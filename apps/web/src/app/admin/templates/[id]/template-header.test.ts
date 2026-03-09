import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/templates/[id]/template-header.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./template-header");
    expect(mod).toBeDefined();
  });
});
