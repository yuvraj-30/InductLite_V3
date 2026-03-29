import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/components/ui/theme-switcher.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./theme-switcher");
    expect(mod).toBeDefined();
  });

  it("keeps the compact appearance menu for quieter public chrome", () => {
    const source = fs.readFileSync(path.join(__dirname, "theme-switcher.tsx"), "utf8");

    expect(source).toContain("Appearance");
    expect(source).toContain('role="menuitemradio"');
  });
});
