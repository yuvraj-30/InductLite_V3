#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_MATRIX_PATH = "docs/COMPETITOR_PARITY_CONTROL_MATRIX.md";
const ENTITLEMENTS_PATH = "apps/web/src/lib/plans/entitlements.ts";
const REQUIRED_COLUMNS = [
  "Control ID",
  "Competitor Signal",
  "Capability",
  "Plan Target",
  "Gate Class",
  "Entitlement Key",
  "Status",
  "Implementation Refs",
  "Test Refs",
  "Notes",
];
const ALLOWED_GATE_CLASSES = new Set(["required", "monitor"]);
const ALLOWED_STATUSES = new Set(["implemented", "partial", "missing", "planned"]);
const EMPTY_TOKENS = new Set(["", "-", "n/a", "na", "none"]);

function parseArgs(argv) {
  const args = { matrixPath: DEFAULT_MATRIX_PATH };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--matrix") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --matrix");
      }
      args.matrixPath = value;
      i += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      console.log("Usage:");
      console.log("  node tools/parity-gate.mjs");
      console.log("  node tools/parity-gate.mjs --matrix docs/COMPETITOR_PARITY_CONTROL_MATRIX.md");
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function splitTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return [];
  }
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorLine(line) {
  return /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|$/.test(line.trim());
}

function parseMatrixTable(content) {
  const lines = content.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.includes("| Control ID |"));
  if (headerIndex === -1) {
    throw new Error('Matrix table header not found (expected "| Control ID | ...").');
  }

  const headerCells = splitTableRow(lines[headerIndex]);
  if (headerCells.length === 0) {
    throw new Error("Failed to parse matrix header row.");
  }

  for (const column of REQUIRED_COLUMNS) {
    if (!headerCells.includes(column)) {
      throw new Error(`Matrix missing required column: ${column}`);
    }
  }

  const headerMap = new Map(headerCells.map((name, index) => [name, index]));
  const rows = [];

  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith("|")) {
      if (rows.length > 0) break;
      continue;
    }
    if (isSeparatorLine(line)) continue;

    const cells = splitTableRow(line);
    if (cells.length !== headerCells.length) {
      throw new Error(
        `Matrix row ${i + 1} has ${cells.length} cells; expected ${headerCells.length}.`,
      );
    }

    const row = {};
    for (const [name, index] of headerMap.entries()) {
      row[name] = cells[index] ?? "";
    }
    row._line = i + 1;
    rows.push(row);
  }

  if (rows.length === 0) {
    throw new Error("Matrix table has no data rows.");
  }

  return rows;
}

function loadFeatureKeys(entitlementsPath) {
  const source = fs.readFileSync(entitlementsPath, "utf8");
  const block = source.match(
    /export const PRODUCT_FEATURE_KEYS\s*=\s*\[([\s\S]*?)\]\s*as const;/,
  );
  if (!block) {
    throw new Error("Could not parse PRODUCT_FEATURE_KEYS from entitlements.ts");
  }

  const keys = [...block[1].matchAll(/"([A-Z0-9_]+)"/g)].map((match) => match[1]);
  if (keys.length === 0) {
    throw new Error("No feature keys were parsed from entitlements.ts");
  }
  return new Set(keys);
}

function normalizeRefToken(token) {
  if (!token) return null;
  let value = token.trim();
  value = value.replace(/^`(.+)`$/, "$1");

  const markdownLink = value.match(/^\[[^\]]+\]\(([^)]+)\)$/);
  if (markdownLink) {
    value = markdownLink[1].trim();
  }

  if (EMPTY_TOKENS.has(value.toLowerCase())) {
    return null;
  }

  value = value.split("#")[0].trim();
  if (/:[0-9]+(:[0-9]+)?$/.test(value) && !/^[A-Za-z]:[\\/]/.test(value)) {
    value = value.replace(/:[0-9]+(:[0-9]+)?$/, "");
  }

  return value.trim();
}

function parseRefs(value) {
  return value
    .split(";")
    .map((token) => normalizeRefToken(token))
    .filter((token) => Boolean(token));
}

function isExternalRef(ref) {
  return /^https?:\/\//i.test(ref);
}

function resolveRepoPath(rootDir, ref) {
  if (isExternalRef(ref)) return ref;
  return path.resolve(rootDir, ref);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const matrixPath = path.resolve(rootDir, args.matrixPath);
  const entitlementsPath = path.resolve(rootDir, ENTITLEMENTS_PATH);

  if (!fs.existsSync(matrixPath)) {
    throw new Error(`Matrix file not found: ${matrixPath}`);
  }
  if (!fs.existsSync(entitlementsPath)) {
    throw new Error(`Entitlements file not found: ${entitlementsPath}`);
  }

  const matrixContent = fs.readFileSync(matrixPath, "utf8");
  const rows = parseMatrixTable(matrixContent);
  const featureKeys = loadFeatureKeys(entitlementsPath);

  const errors = [];
  const warnings = [];
  const seenControlIds = new Set();
  let requiredCount = 0;
  let monitorCount = 0;

  for (const row of rows) {
    const controlId = row["Control ID"].trim();
    const gateClass = row["Gate Class"].trim().toLowerCase();
    const status = row["Status"].trim().toLowerCase();
    const entitlementKey = row["Entitlement Key"].trim();
    const implRefs = parseRefs(row["Implementation Refs"]);
    const testRefs = parseRefs(row["Test Refs"]);

    if (!controlId) {
      errors.push(`[line ${row._line}] Control ID is required.`);
      continue;
    }
    if (seenControlIds.has(controlId)) {
      errors.push(`[line ${row._line}] Duplicate Control ID: ${controlId}`);
    }
    seenControlIds.add(controlId);

    if (!ALLOWED_GATE_CLASSES.has(gateClass)) {
      errors.push(
        `[line ${row._line}] ${controlId}: Gate Class must be one of ${[...ALLOWED_GATE_CLASSES].join(", ")}.`,
      );
      continue;
    }

    if (!ALLOWED_STATUSES.has(status)) {
      errors.push(
        `[line ${row._line}] ${controlId}: Status must be one of ${[...ALLOWED_STATUSES].join(", ")}.`,
      );
    }

    if (gateClass === "required") requiredCount += 1;
    if (gateClass === "monitor") monitorCount += 1;

    const entitlementNormalized = entitlementKey.toLowerCase();
    if (!EMPTY_TOKENS.has(entitlementNormalized) && !featureKeys.has(entitlementKey)) {
      errors.push(
        `[line ${row._line}] ${controlId}: unknown Entitlement Key "${entitlementKey}" (not in PRODUCT_FEATURE_KEYS).`,
      );
    }

    if ((status === "implemented" || status === "partial") && implRefs.length === 0) {
      errors.push(
        `[line ${row._line}] ${controlId}: implemented/partial rows must include Implementation Refs.`,
      );
    }

    if (gateClass === "required") {
      if (status !== "implemented") {
        errors.push(
          `[line ${row._line}] ${controlId}: required gate rows must be status=implemented (current=${status}).`,
        );
      }
      if (implRefs.length === 0) {
        errors.push(`[line ${row._line}] ${controlId}: required gate rows need Implementation Refs.`);
      }
      if (testRefs.length === 0) {
        errors.push(`[line ${row._line}] ${controlId}: required gate rows need Test Refs.`);
      }
    }

    for (const ref of [...implRefs, ...testRefs]) {
      if (isExternalRef(ref)) continue;
      const absolute = resolveRepoPath(rootDir, ref);
      if (!fs.existsSync(absolute)) {
        errors.push(`[line ${row._line}] ${controlId}: referenced path not found -> ${ref}`);
      }
    }

    if (gateClass === "monitor" && status !== "implemented") {
      warnings.push(`${controlId}: monitor gap (${status}) - ${row["Capability"]}`);
    }
  }

  console.log(`[parity-gate] Matrix file: ${args.matrixPath}`);
  console.log(`[parity-gate] Parsed rows: ${rows.length}`);
  console.log(`[parity-gate] Required rows: ${requiredCount}`);
  console.log(`[parity-gate] Monitor rows: ${monitorCount}`);
  console.log(`[parity-gate] Product feature keys: ${featureKeys.size}`);

  if (warnings.length > 0) {
    console.log("[parity-gate] Monitor gaps:");
    for (const warning of warnings) {
      console.log(`  - ${warning}`);
    }
  }

  if (errors.length > 0) {
    console.error("[parity-gate] FAILED");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log("[parity-gate] PASS");
}

main();
