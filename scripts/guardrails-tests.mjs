import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const CHECKS = [
  {
    file: "apps/web/src/lib/cost/compute-counters.ts",
    patterns: [
      "export function recordComputeInvocation",
      "export function recordComputeRuntimeMinutes",
      "export function getComputeCounterSnapshot",
    ],
  },
  {
    file: "apps/web/src/lib/api/response.ts",
    patterns: [
      "export interface GuardrailViolation",
      "controlId: string;",
      "violatedLimit: string;",
      "scope: GuardrailScope;",
      "export function guardrailDeniedResponse",
    ],
  },
  {
    file: "apps/web/src/app/admin/exports/actions.ts",
    patterns: ["guardrailDeniedResponse(", "\"EXPT-008\""],
  },
  {
    file: "apps/web/src/lib/cost/__tests__/compute-counters.test.ts",
    patterns: ['describe("compute counters"', "records invocation counters"],
  },
  {
    file: "apps/web/src/lib/api/__tests__/response.guardrails.test.ts",
    patterns: ['describe("guardrail denial payloads"', "controlId: \"EXPT-003\""],
  },
  {
    file: "apps/web/src/lib/env-validation.ts",
    patterns: [
      "const BUDGET_TIER_LIMITS",
      "const REQUIRED_PRODUCTION_GUARDRAILS",
      "Production requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN",
    ],
  },
  {
    file: "apps/web/src/app/api/integrations/channels/actions/route.ts",
    patterns: [
      "x-inductlite-timestamp",
      "checkChannelActionRateLimit",
      "CONTROL_ID: INT-002",
    ],
  },
  {
    file: "apps/web/src/app/api/integrations/channels/actions/route.test.ts",
    patterns: [
      "returns 403 when callback timestamp is stale",
      "returns 429 when channel callback rate limit is exceeded",
    ],
  },
];

function readText(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function main() {
  const errors = [];

  for (const check of CHECKS) {
    let text = "";
    try {
      text = readText(check.file);
    } catch (error) {
      errors.push(String(error));
      continue;
    }

    for (const pattern of check.patterns) {
      if (!text.includes(pattern)) {
        errors.push(
          `Missing pattern in ${check.file}: ${JSON.stringify(pattern)}`,
        );
      }
    }
  }

  if (errors.length > 0) {
    console.error("[guardrails-tests] failed");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("[guardrails-tests] source checks passed");
}

main();
