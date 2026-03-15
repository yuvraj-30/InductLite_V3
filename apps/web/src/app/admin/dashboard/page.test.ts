import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/dashboard/page.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./page");
    expect(mod).toBeDefined();
  });

  it("keeps the quiz signals table keyboard-focusable", () => {
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");

    expect(source).toContain('id="quiz-performance-signals-heading"');
    expect(source).toContain('tabIndex={0}');
    expect(source).toContain('role="region"');
    expect(source).toContain('aria-labelledby="quiz-performance-signals-heading"');
  });
});
