import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createPrismaClient } from "@/lib/db/prisma";

type CliOptions = {
  days: number;
  out?: string;
};

type ReportRow = {
  company_id: string;
  runs: number;
  recommendations: number;
  decisions: number;
  accepted: number;
  edited: number;
  rejected: number;
  acceptance_rate: string;
  edit_rate: string;
  rejection_rate: string;
  decision_coverage_rate: string;
  delta_open_permits: number;
  delta_open_hazards: number;
  delta_open_incidents: number;
  delta_prequal_pending: number;
  delta_high_risk_profiles: number;
};

function parseCliOptions(argv: string[]): CliOptions {
  const defaults: CliOptions = {
    days: 7,
  };

  for (const arg of argv) {
    if (arg.startsWith("--days=")) {
      const parsed = Number.parseInt(arg.slice("--days=".length), 10);
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 31) {
        throw new Error(`Invalid --days value: ${arg}`);
      }
      defaults.days = parsed;
      continue;
    }

    if (arg.startsWith("--out=")) {
      defaults.out = arg.slice("--out=".length).trim();
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      throw new Error(
        "Usage: npm run -w apps/web report:copilot-weekly -- [--days=7] [--out=docs/copilot-weekly.csv]",
      );
    }
  }

  return defaults;
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }
  return value;
}

function parsePayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function rate(numerator: number, denominator: number): string {
  if (denominator <= 0) return "0.0000";
  return (numerator / denominator).toFixed(4);
}

function toSignalSnapshot(value: unknown): {
  openPermits: number;
  openHazards: number;
  openIncidents: number;
  prequalPending: number;
  highRiskProfiles: number;
} {
  const row = parsePayload(value);
  return {
    openPermits: typeof row.openPermits === "number" ? row.openPermits : 0,
    openHazards: typeof row.openHazards === "number" ? row.openHazards : 0,
    openIncidents: typeof row.openIncidents === "number" ? row.openIncidents : 0,
    prequalPending: typeof row.prequalPending === "number" ? row.prequalPending : 0,
    highRiskProfiles:
      typeof row.highRiskProfiles === "number" ? row.highRiskProfiles : 0,
  };
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const now = new Date();
  const from = new Date(now.getTime() - options.days * 24 * 60 * 60 * 1000);
  const outputPath =
    options.out ?? `docs/copilot-weekly-${now.toISOString().slice(0, 10)}.csv`;

  const prisma = createPrismaClient();
  try {
    const [runs, decisions] = await Promise.all([
      prisma.communicationEvent.findMany({
        where: {
          event_type: "ai.copilot.run",
          created_at: {
            gte: from,
            lte: now,
          },
        },
        select: {
          company_id: true,
          payload: true,
          created_at: true,
        },
        orderBy: [{ created_at: "asc" }],
        take: 50_000,
      }),
      prisma.communicationEvent.findMany({
        where: {
          event_type: "ai.copilot.decision",
          created_at: {
            gte: from,
            lte: now,
          },
        },
        select: {
          company_id: true,
          status: true,
        },
        take: 100_000,
      }),
    ]);

    const runMap = new Map<string, typeof runs>();
    for (const run of runs) {
      const list = runMap.get(run.company_id) ?? [];
      list.push(run);
      runMap.set(run.company_id, list);
    }

    const decisionMap = new Map<string, typeof decisions>();
    for (const decision of decisions) {
      const list = decisionMap.get(decision.company_id) ?? [];
      list.push(decision);
      decisionMap.set(decision.company_id, list);
    }

    const companyIds = new Set<string>([
      ...Array.from(runMap.keys()),
      ...Array.from(decisionMap.keys()),
    ]);
    const rows: ReportRow[] = [];

    for (const companyId of companyIds) {
      const companyRuns = runMap.get(companyId) ?? [];
      const companyDecisions = decisionMap.get(companyId) ?? [];

      const accepted = companyDecisions.filter((event) => event.status === "ACCEPTED").length;
      const edited = companyDecisions.filter((event) => event.status === "EDITED").length;
      const rejected = companyDecisions.filter((event) => event.status === "REJECTED").length;
      const decisionCount = accepted + edited + rejected;

      let recommendationCount = 0;
      for (const run of companyRuns) {
        const payload = parsePayload(run.payload);
        const recommendations = Array.isArray(payload.recommendations)
          ? payload.recommendations
          : [];
        recommendationCount += recommendations.length;
      }

      let deltaOpenPermits = 0;
      let deltaOpenHazards = 0;
      let deltaOpenIncidents = 0;
      let deltaPrequalPending = 0;
      let deltaHighRiskProfiles = 0;
      if (companyRuns.length >= 2) {
        const firstSignals = toSignalSnapshot(parsePayload(companyRuns[0].payload).signals);
        const lastSignals = toSignalSnapshot(
          parsePayload(companyRuns[companyRuns.length - 1].payload).signals,
        );
        deltaOpenPermits = lastSignals.openPermits - firstSignals.openPermits;
        deltaOpenHazards = lastSignals.openHazards - firstSignals.openHazards;
        deltaOpenIncidents = lastSignals.openIncidents - firstSignals.openIncidents;
        deltaPrequalPending = lastSignals.prequalPending - firstSignals.prequalPending;
        deltaHighRiskProfiles =
          lastSignals.highRiskProfiles - firstSignals.highRiskProfiles;
      }

      rows.push({
        company_id: companyId,
        runs: companyRuns.length,
        recommendations: recommendationCount,
        decisions: decisionCount,
        accepted,
        edited,
        rejected,
        acceptance_rate: rate(accepted, decisionCount),
        edit_rate: rate(edited, decisionCount),
        rejection_rate: rate(rejected, decisionCount),
        decision_coverage_rate: rate(decisionCount, recommendationCount),
        delta_open_permits: deltaOpenPermits,
        delta_open_hazards: deltaOpenHazards,
        delta_open_incidents: deltaOpenIncidents,
        delta_prequal_pending: deltaPrequalPending,
        delta_high_risk_profiles: deltaHighRiskProfiles,
      });
    }

    const header = [
      "company_id",
      "runs",
      "recommendations",
      "decisions",
      "accepted",
      "edited",
      "rejected",
      "acceptance_rate",
      "edit_rate",
      "rejection_rate",
      "decision_coverage_rate",
      "delta_open_permits",
      "delta_open_hazards",
      "delta_open_incidents",
      "delta_prequal_pending",
      "delta_high_risk_profiles",
      "window_start",
      "window_end",
    ];

    const lines = [
      header.join(","),
      ...rows.map((row) =>
        [
          csvEscape(row.company_id),
          String(row.runs),
          String(row.recommendations),
          String(row.decisions),
          String(row.accepted),
          String(row.edited),
          String(row.rejected),
          row.acceptance_rate,
          row.edit_rate,
          row.rejection_rate,
          row.decision_coverage_rate,
          String(row.delta_open_permits),
          String(row.delta_open_hazards),
          String(row.delta_open_incidents),
          String(row.delta_prequal_pending),
          String(row.delta_high_risk_profiles),
          from.toISOString(),
          now.toISOString(),
        ].join(","),
      ),
    ];

    const absoluteOutputPath = resolve(outputPath);
    await mkdir(dirname(absoluteOutputPath), { recursive: true });
    await writeFile(absoluteOutputPath, `${lines.join("\n")}\n`, "utf8");

    console.log(
      JSON.stringify(
        {
          ok: true,
          output: absoluteOutputPath,
          windowStart: from.toISOString(),
          windowEnd: now.toISOString(),
          rows: rows.length,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
