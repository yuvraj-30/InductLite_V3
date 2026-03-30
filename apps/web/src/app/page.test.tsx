import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("apps/web/src/app/page.tsx", () => {
  it("contains the tightened public hierarchy and proof sections", () => {
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    expect(source).toContain(
      "Move arrival, induction, and clearance into one operator-ready flow.",
    );
    expect(source).toContain("What site teams actually get");
    expect(source).toContain("Launch the first site in three moves");
    expect(source).toContain("Simple tier coverage");
  });

  it("keeps the shorter capability story instead of the older long-form feature stack", () => {
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    expect(source).toContain("const CAPABILITY_PILLARS = [");
    expect(source).not.toContain("PRIMARY_FEATURE_GROUP");
    expect(source).not.toContain("SUPPORTING_FEATURE_GROUPS");
    expect(source).not.toContain("LATEST_RELEASES");
  });

  it("keeps integrations compact and preserves the final CTA", () => {
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    expect(source).toContain("Connected when useful");
    expect(source).toContain("Launch your first live site flow with one clear next step.");
    expect(source).not.toContain("Integrations and rollout support");
    expect(source).not.toContain("Recent operating additions");
  });
});
