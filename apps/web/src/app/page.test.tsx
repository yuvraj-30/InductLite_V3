import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("apps/web/src/app/page.tsx", () => {
  it("contains the hero workflow card markup", () => {
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    expect(source).toContain("Typical Workflow");
  });

  it("does not render a complementary landmark inside the hero workflow card", () => {
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    expect(source).toContain('<div className="surface-panel p-4 lg:col-span-2">');
    expect(source).not.toContain("<aside");
  });
});
