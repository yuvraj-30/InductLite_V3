import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("apps/web/src/app/page.tsx", () => {
  it("contains the grouped feature workflow section markup", () => {
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    expect(source).toContain("One platform from arrival to audit trail");
    expect(source).toContain("Primary workflow");
    expect(source).toContain("Where teams feel it first");
    expect(source).toContain("From arrival to evidence in four steps");
  });

  it("uses the grouped bento primary workflow card instead of the legacy flat feature grid", () => {
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    expect(source).toContain('<article className="bento-card lg:col-span-2">');
    expect(source).not.toContain("Typical Workflow");
    expect(source).not.toContain("What Clients Expect in 2026");
  });

  it("keeps integrations and support lower on the page with the tightened final CTA", () => {
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    expect(source).toContain("Integrations and rollout support");
    expect(source).toContain("Launch your first live site flow with one clear next step.");
    expect(source).not.toContain("Integrations and Operations");
    expect(source).not.toContain("Latest Releases");
  });
});
