import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const REQUIRED_ARTIFACTS = [
  "docs/critical-paths.md",
  "docs/guardrail-control-matrix.md",
  "docs/guardrail-exceptions.md",
  "docs/tenant-owned-models.md",
  "docs/schemas/critical-paths.schema.json",
  "docs/schemas/guardrail-control-matrix.schema.json",
  "docs/schemas/guardrail-exceptions.schema.json",
  "docs/schemas/tenant-owned-models.schema.json",
];

const REQUIRED_ARCHITECTURE_PATTERNS = [
  "MAX_MONTHLY_COMPUTE_INVOCATIONS",
  "MAX_MONTHLY_COMPUTE_RUNTIME_MINUTES",
  "deterministic error payloads containing `CONTROL_ID`",
  "MAX_TENANT_COMPUTE_INVOCATIONS_PER_MONTH",
];

const REQUIRED_MATRIX_CONTROL_IDS = [
  "COST-005",
  "COST-006",
  "COST-007",
  "EXPT-003",
  "EXPT-004",
  "EXPT-008",
  "TENANT-006",
  "API-001",
];

function read(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing file: ${relativePath}`);
  }
  return fs.readFileSync(fullPath, "utf8");
}

function assertNonEmpty(relativePath, errors) {
  try {
    const text = read(relativePath);
    if (!text.trim()) {
      errors.push(`Policy artifact is empty: ${relativePath}`);
    }
  } catch (error) {
    errors.push(String(error));
  }
}

function main() {
  const errors = [];

  for (const artifact of REQUIRED_ARTIFACTS) {
    assertNonEmpty(artifact, errors);
  }

  const architecture = read("ARCHITECTURE_GUARDRAILS.md");
  for (const pattern of REQUIRED_ARCHITECTURE_PATTERNS) {
    if (!architecture.includes(pattern)) {
      errors.push(
        `ARCHITECTURE_GUARDRAILS.md missing required policy text: ${JSON.stringify(pattern)}`,
      );
    }
  }

  const matrix = read("docs/guardrail-control-matrix.md");
  for (const controlId of REQUIRED_MATRIX_CONTROL_IDS) {
    if (!matrix.includes(`| ${controlId} |`)) {
      errors.push(
        `guardrail-control-matrix.md missing required control_id ${controlId}`,
      );
    }
  }

  const rootPackageJson = JSON.parse(read("package.json"));
  const requiredScripts = ["guardrails-lint", "guardrails-tests", "policy-check"];
  for (const scriptName of requiredScripts) {
    if (!rootPackageJson.scripts?.[scriptName]) {
      errors.push(`package.json missing npm script: ${scriptName}`);
    }
  }

  if (errors.length > 0) {
    console.error("[policy-check] failed");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("[policy-check] passed");
}

main();
