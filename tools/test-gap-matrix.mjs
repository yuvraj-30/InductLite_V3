#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const SOURCE_ROOTS = ["apps/web/src", "apps/mobile/src", "packages/shared/src"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs"]);
const TEST_FILE_RE = /(^|\.)(test|spec)\.(ts|tsx|js|mjs)$/i;

const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".git",
]);

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function isSourceFile(filePath) {
  const extension = path.extname(filePath);
  if (!SOURCE_EXTENSIONS.has(extension)) return false;
  if (TEST_FILE_RE.test(path.basename(filePath))) return false;
  if (filePath.includes(`${path.sep}__tests__${path.sep}`)) return false;
  if (filePath.endsWith(".d.ts")) return false;
  return true;
}

function isTestFile(filePath) {
  if (filePath.includes(`${path.sep}__tests__${path.sep}`)) return true;
  return TEST_FILE_RE.test(path.basename(filePath));
}

function sameModuleTestPaths(sourceRel) {
  const extension = path.extname(sourceRel);
  const base = sourceRel.slice(0, -extension.length);
  const fileName = path.basename(base);
  const dirName = path.dirname(base);
  const suffixes = [
    ".test.ts",
    ".test.tsx",
    ".spec.ts",
    ".spec.tsx",
    ".unit.test.ts",
    ".unit.test.tsx",
    ".integration.test.ts",
    ".integration.test.tsx",
    ".e2e.test.ts",
    ".e2e.test.tsx",
  ];

  const paths = new Set();
  for (const suffix of suffixes) {
    paths.add(`${base}${suffix}`);
    paths.add(`${dirName}/__tests__/${fileName}${suffix}`);
  }

  return new Set([
    ...paths,
  ]);
}

function priorityFor(file) {
  const normalized = file.toLowerCase();
  if (
    normalized.includes("/src/app/api/") ||
    normalized.endsWith("/actions.ts") ||
    normalized.includes("/src/lib/repository/") ||
    normalized.includes("/src/lib/auth/") ||
    normalized.includes("/src/lib/db/") ||
    normalized.includes("/src/lib/guardrails")
  ) {
    return "P0";
  }

  if (
    normalized.includes("/src/lib/") ||
    normalized.includes("/src/app/") ||
    normalized.includes("/scripts/")
  ) {
    return "P1";
  }

  return "P2";
}

function riskFor(file) {
  const normalized = file.toLowerCase();
  if (normalized.includes("/src/app/api/")) return "Public/API contract";
  if (normalized.endsWith("/actions.ts")) return "Mutating server action";
  if (normalized.includes("/src/lib/repository/")) return "Tenant-scoped data access";
  if (normalized.includes("/src/lib/auth/")) return "Auth/security flow";
  if (normalized.includes("/src/lib/db/")) return "Data layer infrastructure";
  return "Application logic";
}

function collectFiles() {
  const sourceFiles = [];
  const testFiles = [];

  for (const sourceRoot of SOURCE_ROOTS) {
    const absoluteRoot = path.join(ROOT, sourceRoot);
    for (const file of walk(absoluteRoot)) {
      if (isSourceFile(file)) sourceFiles.push(rel(file));
      if (isTestFile(file)) testFiles.push(rel(file));
    }
  }

  sourceFiles.sort();
  testFiles.sort();
  return { sourceFiles, testFiles };
}

function buildMatrix() {
  const { sourceFiles, testFiles } = collectFiles();
  const testSet = new Set(testFiles);

  const rows = sourceFiles.map((sourceFile) => {
    const directCandidates = sameModuleTestPaths(sourceFile);
    const directTests = [...directCandidates].filter((candidate) =>
      testSet.has(candidate),
    );
    const hasDirectTest = directTests.length > 0;

    return {
      sourceFile,
      hasDirectTest,
      directTests,
      priority: priorityFor(sourceFile),
      risk: riskFor(sourceFile),
      status: hasDirectTest ? "Covered" : "Gap",
    };
  });

  const summary = {
    totalSourceFiles: rows.length,
    coveredByDirectTests: rows.filter((row) => row.hasDirectTest).length,
    gaps: rows.filter((row) => !row.hasDirectTest).length,
  };

  return { generatedAt: new Date().toISOString(), summary, rows, testFiles };
}

function writeOutputs(matrix) {
  const outDir = path.join(ROOT, "docs");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, "TEST_GAP_MATRIX.json");
  fs.writeFileSync(jsonPath, `${JSON.stringify(matrix, null, 2)}\n`, "utf8");

  const gapRows = matrix.rows
    .filter((row) => row.status === "Gap")
    .sort((a, b) => {
      const order = { P0: 0, P1: 1, P2: 2 };
      return order[a.priority] - order[b.priority] || a.sourceFile.localeCompare(b.sourceFile);
    });

  const lines = [];
  lines.push("# Test Gap Matrix");
  lines.push("");
  lines.push(`Generated: ${matrix.generatedAt}`);
  lines.push("");
  lines.push(`- Total source files: ${matrix.summary.totalSourceFiles}`);
  lines.push(
    `- Covered by direct tests: ${matrix.summary.coveredByDirectTests}`,
  );
  lines.push(`- Gaps: ${matrix.summary.gaps}`);
  lines.push("");
  lines.push("## Prioritized Missing-Tests Backlog");
  lines.push("");
  lines.push("| Priority | Source File | Risk | Suggested Test Type |");
  lines.push("| --- | --- | --- | --- |");
  for (const row of gapRows.slice(0, 150)) {
    const testType = row.sourceFile.includes("/src/app/api/")
      ? "Route handler unit/integration test"
      : row.sourceFile.endsWith("/actions.ts")
        ? "Server action unit test (redirect/error paths)"
        : row.sourceFile.includes("/src/lib/repository/")
          ? "Repository unit/integration test"
          : "Unit test";
    lines.push(
      `| ${row.priority} | \`${row.sourceFile}\` | ${row.risk} | ${testType} |`,
    );
  }
  lines.push("");
  lines.push("## Full Matrix");
  lines.push("");
  lines.push("| Source File | Status | Priority | Direct Test(s) |");
  lines.push("| --- | --- | --- | --- |");
  for (const row of matrix.rows) {
    lines.push(
      `| \`${row.sourceFile}\` | ${row.status} | ${row.priority} | ${row.directTests.map((item) => `\`${item}\``).join(", ") || "-"} |`,
    );
  }
  lines.push("");

  const mdPath = path.join(outDir, "TEST_GAP_MATRIX.md");
  fs.writeFileSync(mdPath, `${lines.join("\n")}\n`, "utf8");

  return { jsonPath: rel(jsonPath), mdPath: rel(mdPath), gapRows };
}

function main() {
  const matrix = buildMatrix();
  const outputs = writeOutputs(matrix);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        summary: matrix.summary,
        outputs,
      },
      null,
      2,
    ),
  );
}

main();
