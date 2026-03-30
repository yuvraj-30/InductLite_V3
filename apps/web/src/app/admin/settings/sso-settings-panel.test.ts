import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/settings/sso-settings-panel.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./sso-settings-panel");
    expect(mod).toBeDefined();
  });

  it("breaks identity settings into calmer disclosure groups", () => {
    const source = fs.readFileSync(path.join(__dirname, "sso-settings-panel.tsx"), "utf8");

    expect(source).toContain("AdminDisclosureSection");
    expect(source).toContain("SSO provider setup");
    expect(source).toContain("Directory sync and partner API");
    expect(source).toContain("Directory sync API key");
    expect(source).toContain("const [defaultRoleValue, setDefaultRoleValue]");
    expect(source).toContain("value={defaultRoleValue}");
  });
});
