import fs from "node:fs";
import path from "node:path";
import {
  parseMarkdownTable,
  REQUIRED_GUARDRAIL_CONTROLS,
} from "./guardrail-contract.mjs";

const ROOT = process.cwd();
const MATRIX_PATH = path.join(ROOT, "docs", "guardrail-control-matrix.md");

function main() {
  const markdown = fs.readFileSync(MATRIX_PATH, "utf8");
  const rows = parseMarkdownTable(markdown);
  const errors = [];
  const envExample = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");

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

  for (const required of REQUIRED_GUARDRAIL_CONTROLS) {
    const found = rows.find(
      (row) =>
        row.controlId === required.controlId && row.envVar === required.envVar,
    );
    if (!found) {
      errors.push(
        `Missing required control mapping ${required.controlId} -> ${required.envVar}`,
      );
      continue;
    }

    for (const [fieldName, value] of [
      ["default", found.defaultValue],
      ["max_by_tier", found.maxByTier],
      ["enforcement_path", found.enforcementPath],
      ["test_id", found.testId],
      ["owner", found.owner],
    ]) {
      if (!value) {
        errors.push(
          `Required control ${required.controlId} is missing ${fieldName}.`,
        );
      }
    }

    if (
      required.envVar !== "N/A" &&
      !envExample.includes(`${required.envVar}=`)
    ) {
      errors.push(
        `.env.example missing required guardrail env var ${required.envVar}`,
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
