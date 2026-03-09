import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/settings/sso-settings-panel.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./sso-settings-panel");
    expect(mod).toBeDefined();
  });
});
