#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const matrixPath = path.join(root, "docs", "TEST_GAP_MATRIX.json");

if (!fs.existsSync(matrixPath)) {
  // eslint-disable-next-line no-console
  console.error("Missing docs/TEST_GAP_MATRIX.json. Run npm run test:gap-matrix first.");
  process.exit(1);
}

const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
const mode = process.argv.includes("--all") ? "all" : "p0";
const targetGaps = matrix.rows.filter((row) => {
  if (row.status !== "Gap") return false;
  if (mode === "all") return true;
  return row.priority === "P0";
});

function toPosix(filePath) {
  return filePath.replace(/\\/g, "/");
}

function withoutExtension(filePath) {
  return filePath.replace(/\.(ts|tsx|js|mjs)$/, "");
}

function testPathForSource(sourceRel) {
  const sourceDir = path.dirname(sourceRel);
  const sourceBase = path.basename(sourceRel, path.extname(sourceRel));

  if (sourceBase === "route" || sourceBase === "actions" || sourceBase === "index") {
    return path.join(sourceDir, `${sourceBase}.test.ts`);
  }

  if (sourceRel.includes("/src/lib/repository/")) {
    const candidate = path.join(sourceDir, "__tests__", `${sourceBase}.test.ts`);
    if (!fs.existsSync(path.join(root, candidate))) return candidate;
    return path.join(sourceDir, "__tests__", `${sourceBase}.smoke.test.ts`);
  }

  return path.join(sourceDir, `${sourceBase}.test.ts`);
}

function importPathFromTest(testRel, sourceRel) {
  const testDir = path.dirname(testRel);
  const relative = path.relative(testDir, withoutExtension(sourceRel));
  const normalized = toPosix(relative);
  if (normalized.startsWith(".")) return normalized;
  return `./${normalized}`;
}

function buildTestContent(sourceRel, importPath) {
  return `import { describe, expect, it } from "vitest";

describe("smoke: ${sourceRel}", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("${importPath}");
    expect(mod).toBeDefined();
  });
});
`;
}

let created = 0;
const written = [];

for (const row of targetGaps) {
  const sourceRel = toPosix(row.sourceFile);
  const testRel = toPosix(testPathForSource(sourceRel));
  const testAbs = path.join(root, testRel);
  if (fs.existsSync(testAbs)) continue;

  const importPath = importPathFromTest(testRel, sourceRel);
  const content = buildTestContent(sourceRel, importPath);
  fs.mkdirSync(path.dirname(testAbs), { recursive: true });
  fs.writeFileSync(testAbs, content, "utf8");
  created += 1;
  written.push(testRel);
}

// eslint-disable-next-line no-console
console.log(
  JSON.stringify(
    {
      mode,
      targetGapCount: targetGaps.length,
      created,
      files: written,
    },
    null,
    2,
  ),
);
