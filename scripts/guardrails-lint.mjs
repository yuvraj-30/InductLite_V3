import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MATRIX_PATH = path.join(ROOT, "docs", "guardrail-control-matrix.md");

const REQUIRED_CONTROLS = [
  { controlId: "COST-005", envVar: "MAX_MONTHLY_COMPUTE_INVOCATIONS" },
  { controlId: "COST-006", envVar: "MAX_MONTHLY_COMPUTE_RUNTIME_MINUTES" },
  { controlId: "COST-007", envVar: "ENV_BUDGET_TIER" },
  { controlId: "FILE-002", envVar: "UPLOAD_ALLOWED_EXTENSIONS" },
  { controlId: "FILE-003", envVar: "UPLOAD_REQUIRE_SERVER_MIME_SNIFF" },
  { controlId: "FILE-004", envVar: "UPLOAD_REQUIRE_MAGIC_BYTES" },
  {
    controlId: "EXPT-003",
    envVar: "MAX_EXPORT_DOWNLOAD_BYTES_PER_COMPANY_PER_DAY",
  },
  {
    controlId: "EXPT-004",
    envVar: "MAX_EXPORT_DOWNLOAD_BYTES_GLOBAL_PER_DAY",
  },
  {
    controlId: "EXPT-005",
    envVar: "EXPORT_OFFPEAK_AUTO_ENABLE_THRESHOLD_PERCENT",
  },
  {
    controlId: "EXPT-006",
    envVar: "EXPORT_OFFPEAK_AUTO_ENABLE_QUEUE_DELAY_SECONDS",
  },
  { controlId: "EXPT-007", envVar: "EXPORT_OFFPEAK_AUTO_ENABLE_DAYS" },
  { controlId: "TENANT-003", envVar: "MAX_TENANT_STORAGE_GB" },
  { controlId: "TENANT-004", envVar: "MAX_TENANT_EGRESS_GB_PER_MONTH" },
  { controlId: "TENANT-005", envVar: "MAX_TENANT_JOB_MINUTES_PER_MONTH" },
  {
    controlId: "TENANT-006",
    envVar: "MAX_TENANT_COMPUTE_INVOCATIONS_PER_MONTH",
  },
];

function parseMarkdownTable(markdown) {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const tableLines = lines.filter((line) => line.startsWith("|"));
  if (tableLines.length < 3) {
    throw new Error("Guardrail control matrix table is missing or empty.");
  }

  return tableLines
    .slice(2)
    .filter((line) => !/^\|\s*-+\s*\|/.test(line))
    .map((line, index) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (cells.length !== 7) {
        throw new Error(
          `Malformed matrix row ${index + 1}: expected 7 columns, got ${cells.length}.`,
        );
      }
      return {
        controlId: cells[0],
        envVar: cells[1],
        defaultValue: cells[2],
        maxByTier: cells[3],
        enforcementPath: cells[4],
        testId: cells[5],
        owner: cells[6],
      };
    });
}

function main() {
  const markdown = fs.readFileSync(MATRIX_PATH, "utf8");
  const rows = parseMarkdownTable(markdown);
  const errors = [];

  const seenControlIds = new Set();
  for (const row of rows) {
    if (!row.controlId) {
      errors.push("Found matrix row with empty control_id.");
      continue;
    }
    if (seenControlIds.has(row.controlId)) {
      errors.push(`Duplicate control_id found: ${row.controlId}`);
    }
    seenControlIds.add(row.controlId);
  }

  for (const required of REQUIRED_CONTROLS) {
    const found = rows.find(
      (row) =>
        row.controlId === required.controlId && row.envVar === required.envVar,
    );
    if (!found) {
      errors.push(
        `Missing required control mapping ${required.controlId} -> ${required.envVar}`,
      );
    }
  }

  if (errors.length > 0) {
    console.error("[guardrails-lint] failed");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `[guardrails-lint] passed (${rows.length} controls, ${seenControlIds.size} unique IDs)`,
  );
}

main();
