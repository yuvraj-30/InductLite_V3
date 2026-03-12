#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DEFAULT_BASELINE = "docs/ux-baseline.csv";
const DEFAULT_POST = "docs/ux-post-release.csv";
const DEFAULT_PERF = "apps/web/test-results/uiux-performance-budget-report.json";
const DEFAULT_OUT = "docs/UI_UX_KPI_READOUT_2026-03-10.md";

function parseArgs(argv) {
  const args = {
    baseline: DEFAULT_BASELINE,
    post: DEFAULT_POST,
    perf: DEFAULT_PERF,
    out: DEFAULT_OUT,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--baseline") {
      args.baseline = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "--post") {
      args.post = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "--perf") {
      args.perf = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "--out") {
      args.out = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      console.log("Usage:");
      console.log("  node tools/uiux-kpi-readout.mjs");
      console.log(
        "  node tools/uiux-kpi-readout.mjs --baseline docs/ux-baseline.csv --post docs/ux-post-release.csv --perf apps/web/test-results/uiux-performance-budget-report.json --out docs/UI_UX_KPI_READOUT_2026-03-10.md",
      );
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function parseCsvRows(raw) {
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((cell) => cell.trim());
  const metricIdx = headers.indexOf("metric");
  const valueIdx = headers.indexOf("value");
  if (metricIdx < 0 || valueIdx < 0) return [];

  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    return {
      metric: (cells[metricIdx] ?? "").trim().replace(/^"|"$/g, ""),
      value: (cells[valueIdx] ?? "").trim().replace(/^"|"$/g, ""),
    };
  });
}

function readMetricMap(filePath) {
  if (!filePath) return new Map();
  if (!fs.existsSync(filePath)) return new Map();
  const raw = fs.readFileSync(filePath, "utf8");
  const rows = parseCsvRows(raw);
  const map = new Map();
  for (const row of rows) {
    if (!row.metric) continue;
    const parsed = Number(row.value);
    if (Number.isFinite(parsed)) {
      map.set(row.metric, parsed);
    }
  }
  return map;
}

function computeMedian(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function readPerfMedianLcp(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  const lcpValues = (parsed.measurements ?? [])
    .map((row) => Number(row.lcpMs))
    .filter((value) => Number.isFinite(value));
  return computeMedian(lcpValues);
}

function pctDelta(base, current) {
  if (!Number.isFinite(base) || base === 0) return null;
  return (current - base) / base;
}

function formatNumber(value, digits = 4) {
  if (!Number.isFinite(value)) return "n/a";
  return value.toFixed(digits);
}

function evaluateKpis({ baselineMap, postMap, perfMedianLcp }) {
  if (Number.isFinite(perfMedianLcp ?? NaN)) {
    postMap.set("perf.lcp_median_ms_key_routes", perfMedianLcp);
  }

  const rows = [];

  const addRow = (row) => rows.push(row);

  const baseline1 = baselineMap.get("induction.completion_rate_from_signature");
  const current1 = postMap.get("induction.completion_rate_from_signature");
  const delta1 =
    Number.isFinite(baseline1) && Number.isFinite(current1)
      ? pctDelta(baseline1, current1)
      : null;
  addRow({
    kpi: "Public sign-in to completed induction conversion",
    baseline: baseline1,
    current: current1,
    delta: delta1,
    threshold: ">= +15%",
    pass: delta1 !== null && delta1 >= 0.15,
    owner: "Growth PM",
    dueDate: "2026-03-24",
  });

  const baseline2 = baselineMap.get("admin.mobile.task_completion_rate_top5");
  const current2 = postMap.get("admin.mobile.task_completion_rate_top5");
  const delta2 =
    Number.isFinite(baseline2) && Number.isFinite(current2)
      ? pctDelta(baseline2, current2)
      : null;
  addRow({
    kpi: "Mobile admin task completion rate (top 5 tasks)",
    baseline: baseline2,
    current: current2,
    delta: delta2,
    threshold: ">= +25%",
    pass: delta2 !== null && delta2 >= 0.25,
    owner: "Mobile UX Lead",
    dueDate: "2026-03-24",
  });

  const baseline3 = baselineMap.get("admin.task_time_median_seconds_top5");
  const current3 = postMap.get("admin.task_time_median_seconds_top5");
  const delta3 =
    Number.isFinite(baseline3) && Number.isFinite(current3)
      ? pctDelta(baseline3, current3)
      : null;
  addRow({
    kpi: "Median time-on-task for top 5 admin tasks",
    baseline: baseline3,
    current: current3,
    delta: delta3,
    threshold: "<= -30%",
    pass: delta3 !== null && delta3 <= -0.3,
    owner: "Web Platform Lead",
    dueDate: "2026-03-24",
  });

  const current4 = postMap.get("a11y.critical_serious_violations_top20");
  addRow({
    kpi: "Accessibility severe violations (top 20 routes)",
    baseline: null,
    current: current4,
    delta: null,
    threshold: "= 0",
    pass: Number.isFinite(current4) && current4 === 0,
    owner: "QA Lead",
    dueDate: "2026-03-24",
  });

  const current5 = postMap.get("perf.lcp_median_ms_key_routes");
  addRow({
    kpi: "Key-route median LCP",
    baseline: null,
    current: current5,
    delta: null,
    threshold: "<= 2500 ms",
    pass: Number.isFinite(current5) && current5 <= 2500,
    owner: "Frontend Lead",
    dueDate: "2026-03-24",
  });

  return rows;
}

function buildMarkdown(rows, paths) {
  const passCount = rows.filter((row) => row.pass).length;
  const failRows = rows.filter((row) => !row.pass);
  const lines = [
    "# UI/UX KPI Readout (S6-002)",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Baseline source: \`${paths.baseline}\``,
    `- Post-release source: \`${paths.post}\``,
    `- Performance source: \`${paths.perf}\``,
    `- Result: **${failRows.length === 0 ? "PASS" : "FAIL"}** (${passCount}/${rows.length} KPIs met)`,
    "",
    "| KPI | Baseline | Post-release | Delta | Threshold | Result |",
    "| --- | ---: | ---: | ---: | --- | --- |",
  ];

  for (const row of rows) {
    const deltaLabel =
      row.delta === null ? "n/a" : `${row.delta >= 0 ? "+" : ""}${(row.delta * 100).toFixed(1)}%`;
    lines.push(
      `| ${row.kpi} | ${formatNumber(row.baseline, 4)} | ${formatNumber(row.current, 4)} | ${deltaLabel} | ${row.threshold} | ${row.pass ? "PASS" : "FAIL"} |`,
    );
  }

  lines.push("");
  lines.push("## Follow-up Backlog");
  if (failRows.length === 0) {
    lines.push("- No follow-up items required.");
  } else {
    lines.push("| KPI | Owner | Due Date | Action |");
    lines.push("| --- | --- | --- | --- |");
    for (const row of failRows) {
      lines.push(
        `| ${row.kpi} | ${row.owner} | ${row.dueDate} | Capture missing telemetry or remediate regression and re-run readout. |`,
      );
    }
  }

  lines.push("");
  lines.push("## Decision");
  lines.push(
    failRows.length === 0
      ? "- Release KPI gate is met."
      : "- Release KPI gate is not fully met. Follow-up actions above are required before GA sign-off.",
  );

  return `${lines.join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const baselinePath = path.resolve(cwd, args.baseline);
  const postPath = path.resolve(cwd, args.post);
  const perfPath = path.resolve(cwd, args.perf);
  const outPath = path.resolve(cwd, args.out);

  const baselineMap = readMetricMap(baselinePath);
  const postMap = readMetricMap(postPath);
  const perfMedianLcp = readPerfMedianLcp(perfPath);
  const rows = evaluateKpis({ baselineMap, postMap, perfMedianLcp });
  const markdown = buildMarkdown(rows, {
    baseline: args.baseline,
    post: args.post,
    perf: args.perf,
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, markdown, "utf8");

  const failed = rows.filter((row) => !row.pass).length;
  console.log(
    JSON.stringify(
      {
        ok: failed === 0,
        output: outPath,
        failed,
        total: rows.length,
      },
      null,
      2,
    ),
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
