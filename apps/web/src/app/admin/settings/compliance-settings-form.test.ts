import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/settings/compliance-settings-form.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./compliance-settings-form");
    expect(mod).toBeDefined();
  });
});
