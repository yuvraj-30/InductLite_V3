import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/templates/new/new-template-form.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./new-template-form");
    expect(mod).toBeDefined();
  });
});
