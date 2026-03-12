#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DEFAULT_INPUT = "apps/web/test-results/uiux-performance-budget-report.json";
const DEFAULT_OUT = "docs/UI_UX_PERFORMANCE_WEEKLY_REPORT.md";

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    out: DEFAULT_OUT,
    failOnBudgetMiss: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--input") {
      const value = argv[i + 1];
      if (!value) throw new Error("Missing value for --input");
      args.input = value;
      i += 1;
      continue;
    }
    if (token === "--out") {
      const value = argv[i + 1];
      if (!value) throw new Error("Missing value for --out");
      args.out = value;
      i += 1;
      continue;
    }
    if (token === "--allow-miss") {
      args.failOnBudgetMiss = false;
      continue;
    }
    if (token === "--help" || token === "-h") {
      console.log("Usage:");
      console.log("  node tools/uiux-performance-budget-report.mjs");
      console.log(
        "  node tools/uiux-performance-budget-report.mjs --input apps/web/test-results/uiux-performance-budget-report.json --out docs/UI_UX_PERFORMANCE_WEEKLY_REPORT.md",
      );
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "n/a";
  return `${Math.round(value * 100)}%`;
}

function summarize(data) {
  const byLabel = new Map(
    (Array.isArray(data.measurements) ? data.measurements : []).map((row) => [
      row.label,
      row,
    ]),
  );
  const rows = [];
  let failedCount = 0;

  for (const budget of Array.isArray(data.budgets) ? data.budgets : []) {
    const measurement = byLabel.get(budget.label);
    const lcpValue = Number(measurement?.lcpMs ?? 0);
    const tbtValue = Number(measurement?.tbtMs ?? 0);
    const jsValue = Number(measurement?.jsBytes ?? 0);
    const lcpPass = lcpValue <= Number(budget.lcpMs);
    const tbtPass = tbtValue <= Number(budget.tbtMs);
    const jsPass = jsValue <= Number(budget.jsBytes);
    const pass = lcpPass && tbtPass && jsPass;
    if (!pass) failedCount += 1;

    rows.push({
      label: budget.label,
      route: budget.route,
      lcpValue,
      tbtValue,
      jsValue,
      lcpBudget: Number(budget.lcpMs),
      tbtBudget: Number(budget.tbtMs),
      jsBudget: Number(budget.jsBytes),
      lcpUtilization: formatPercent(lcpValue / Number(budget.lcpMs || 1)),
      tbtUtilization: formatPercent(tbtValue / Number(budget.tbtMs || 1)),
      jsUtilization: formatPercent(jsValue / Number(budget.jsBytes || 1)),
      pass,
    });
  }

  return {
    generatedAt: data.generatedAt ?? new Date().toISOString(),
    rows,
    failedCount,
  };
}

function buildMarkdown(summary) {
  const status = summary.failedCount === 0 ? "PASS" : "FAIL";
  const lines = [
    "# UI/UX Performance Weekly Report",
    "",
    `- Generated: ${summary.generatedAt}`,
    `- Status: **${status}**`,
    `- Checked routes: ${summary.rows.length}`,
    "",
    "| Route | LCP (ms) | LCP Budget | TBT Surrogate (ms) | TBT Budget | JS Transfer (bytes) | JS Budget | Utilization (LCP/TBT/JS) | Result |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
  ];

  for (const row of summary.rows) {
    lines.push(
      `| \`${row.route}\` | ${row.lcpValue} | ${row.lcpBudget} | ${row.tbtValue} | ${row.tbtBudget} | ${row.jsValue} | ${row.jsBudget} | ${row.lcpUtilization} / ${row.tbtUtilization} / ${row.jsUtilization} | ${row.pass ? "PASS" : "FAIL"} |`,
    );
  }

  lines.push("");
  lines.push("## Notes");
  lines.push("- Metrics are produced by `apps/web/e2e/performance-budget.spec.ts` on chromium stable lane.");
  lines.push("- LCP uses the largest-contentful-paint browser entry (fallback: navigation DOMContentLoaded).");
  lines.push("- TBT surrogate aggregates long-task blocking time above 50ms.");
  lines.push("- JS transfer uses browser resource timings for script resources.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const inputPath = path.resolve(root, args.input);
  const outPath = path.resolve(root, args.out);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input report not found: ${inputPath}`);
  }

  const raw = fs.readFileSync(inputPath, "utf8");
  const data = JSON.parse(raw);
  const summary = summarize(data);
  const markdown = buildMarkdown(summary);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, markdown, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: summary.failedCount === 0,
        input: inputPath,
        output: outPath,
        failedCount: summary.failedCount,
      },
      null,
      2,
    ),
  );

  if (args.failOnBudgetMiss && summary.failedCount > 0) {
    process.exitCode = 1;
  }
}

main();
