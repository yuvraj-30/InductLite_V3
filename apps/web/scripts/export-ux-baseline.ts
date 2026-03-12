import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createPrismaClient } from "@/lib/db/prisma";

type CliOptions = {
  days: number;
  from?: Date;
  to?: Date;
  out?: string;
};

type MetricRow = {
  metric: string;
  value: string;
  window_start: string;
  window_end: string;
  notes: string;
};

function parseDate(value: string, flagName: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${flagName} value: ${value}`);
  }
  return parsed;
}

function parseCliOptions(argv: string[]): CliOptions {
  const defaults: CliOptions = {
    days: 30,
  };

  for (const arg of argv) {
    if (arg.startsWith("--days=")) {
      const parsed = Number.parseInt(arg.slice("--days=".length), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --days value: ${arg}`);
      }
      defaults.days = parsed;
      continue;
    }

    if (arg.startsWith("--from=")) {
      defaults.from = parseDate(arg.slice("--from=".length), "--from");
      continue;
    }

    if (arg.startsWith("--to=")) {
      defaults.to = parseDate(arg.slice("--to=".length), "--to");
      continue;
    }

    if (arg.startsWith("--out=")) {
      defaults.out = arg.slice("--out=".length).trim();
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      throw new Error(
        "Usage: npm run -w apps/web report:ux-baseline -- [--days=30] [--from=ISO] [--to=ISO] [--out=docs/ux-baseline.csv]",
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

function toMetricRow(
  metric: string,
  value: number | string,
  from: Date,
  to: Date,
  notes: string,
): MetricRow {
  return {
    metric,
    value: String(value),
    window_start: from.toISOString(),
    window_end: to.toISOString(),
    notes,
  };
}

function parseDetails(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const to = options.to ?? new Date();
  const from =
    options.from ??
    new Date(to.getTime() - options.days * 24 * 60 * 60 * 1000);
  const outputPath =
    options.out ??
    `docs/ux-baseline-${to.toISOString().slice(0, 10)}.csv`;

  if (from >= to) {
    throw new Error("--from must be earlier than --to");
  }

  const prisma = createPrismaClient();

  try {
    const trackedActions = [
      "auth.login_success",
      "auth.login_failed",
      "auth.sso_start",
      "auth.sso_login",
      "auth.sso_failed",
      "visitor.sign_in",
      "ux.admin.nav_search",
      "ux.induction.step_transition",
    ];

    const groupedCounts = await prisma.auditLog.groupBy({
      by: ["action"],
      where: {
        created_at: {
          gte: from,
          lte: to,
        },
        action: {
          in: trackedActions,
        },
      },
      _count: {
        _all: true,
      },
    });

    const countByAction = new Map<string, number>();
    for (const row of groupedCounts) {
      countByAction.set(row.action, row._count._all);
    }

    const navLogs = await prisma.auditLog.findMany({
      where: {
        action: "ux.admin.nav_search",
        created_at: {
          gte: from,
          lte: to,
        },
      },
      select: {
        details: true,
      },
      take: 20_000,
    });

    const transitionLogs = await prisma.auditLog.findMany({
      where: {
        action: "ux.induction.step_transition",
        created_at: {
          gte: from,
          lte: to,
        },
      },
      select: {
        details: true,
      },
      take: 20_000,
    });

    const navQueryLengths: number[] = [];
    let navZeroResultCount = 0;

    for (const row of navLogs) {
      const details = parseDetails(row.details);
      const queryLength = details.query_length;
      const resultCount = details.result_count;

      if (typeof queryLength === "number" && Number.isFinite(queryLength)) {
        navQueryLengths.push(queryLength);
      }
      if (resultCount === 0) {
        navZeroResultCount += 1;
      }
    }

    const transitions = {
      detailsToInduction: 0,
      inductionToSignature: 0,
      signatureToSuccess: 0,
      backwards: 0,
    };

    for (const row of transitionLogs) {
      const details = parseDetails(row.details);
      const fromStep = details.from_step;
      const toStep = details.to_step;

      if (fromStep === "details" && toStep === "induction") {
        transitions.detailsToInduction += 1;
        continue;
      }
      if (fromStep === "induction" && toStep === "signature") {
        transitions.inductionToSignature += 1;
        continue;
      }
      if (fromStep === "signature" && toStep === "success") {
        transitions.signatureToSuccess += 1;
        continue;
      }
      if (
        (fromStep === "induction" && toStep === "details") ||
        (fromStep === "signature" && toStep === "induction")
      ) {
        transitions.backwards += 1;
      }
    }

    const passwordSuccess = countByAction.get("auth.login_success") ?? 0;
    const passwordFailures = countByAction.get("auth.login_failed") ?? 0;
    const passwordAttempts = passwordSuccess + passwordFailures;
    const ssoStarts = countByAction.get("auth.sso_start") ?? 0;
    const ssoSuccess = countByAction.get("auth.sso_login") ?? 0;
    const ssoFailures = countByAction.get("auth.sso_failed") ?? 0;
    const visitorSignIns = countByAction.get("visitor.sign_in") ?? 0;
    const adminNavSearches = countByAction.get("ux.admin.nav_search") ?? 0;

    const averageQueryLength =
      navQueryLengths.length > 0
        ? navQueryLengths.reduce((sum, value) => sum + value, 0) /
          navQueryLengths.length
        : 0;

    const rows: MetricRow[] = [
      toMetricRow(
        "auth.password.attempts",
        passwordAttempts,
        from,
        to,
        "auth.login_success + auth.login_failed",
      ),
      toMetricRow(
        "auth.password.success",
        passwordSuccess,
        from,
        to,
        "Successful password logins",
      ),
      toMetricRow(
        "auth.password.failed",
        passwordFailures,
        from,
        to,
        "Failed password login attempts",
      ),
      toMetricRow(
        "auth.password.success_rate",
        passwordAttempts > 0
          ? (passwordSuccess / passwordAttempts).toFixed(4)
          : "0.0000",
        from,
        to,
        "success / attempts",
      ),
      toMetricRow("auth.sso.start", ssoStarts, from, to, "SSO flows initiated"),
      toMetricRow("auth.sso.success", ssoSuccess, from, to, "SSO successful callbacks"),
      toMetricRow("auth.sso.failed", ssoFailures, from, to, "SSO failed callbacks"),
      toMetricRow(
        "auth.sso.completion_rate",
        ssoStarts > 0 ? (ssoSuccess / ssoStarts).toFixed(4) : "0.0000",
        from,
        to,
        "sso_success / sso_start",
      ),
      toMetricRow(
        "induction.transition.details_to_induction",
        transitions.detailsToInduction,
        from,
        to,
        "UX telemetry transition count",
      ),
      toMetricRow(
        "induction.transition.induction_to_signature",
        transitions.inductionToSignature,
        from,
        to,
        "UX telemetry transition count",
      ),
      toMetricRow(
        "induction.transition.signature_to_success",
        transitions.signatureToSuccess,
        from,
        to,
        "UX telemetry transition count",
      ),
      toMetricRow(
        "induction.transition.backwards",
        transitions.backwards,
        from,
        to,
        "Back navigation: induction->details or signature->induction",
      ),
      toMetricRow(
        "induction.completed",
        visitorSignIns,
        from,
        to,
        "visitor.sign_in audit events",
      ),
      toMetricRow(
        "induction.completion_rate_from_signature",
        transitions.inductionToSignature > 0
          ? (transitions.signatureToSuccess / transitions.inductionToSignature).toFixed(4)
          : "0.0000",
        from,
        to,
        "signature_to_success / induction_to_signature",
      ),
      toMetricRow(
        "admin.nav.search.count",
        adminNavSearches,
        from,
        to,
        "ux.admin.nav_search events",
      ),
      toMetricRow(
        "admin.nav.search.avg_query_length",
        averageQueryLength.toFixed(2),
        from,
        to,
        "Average of details.query_length",
      ),
      toMetricRow(
        "admin.nav.search.zero_result_rate",
        adminNavSearches > 0
          ? (navZeroResultCount / adminNavSearches).toFixed(4)
          : "0.0000",
        from,
        to,
        "searches with result_count=0 / total searches",
      ),
    ];

    const header = ["metric", "value", "window_start", "window_end", "notes"];
    const csvLines = [
      header.join(","),
      ...rows.map((row) =>
        [
          csvEscape(row.metric),
          csvEscape(row.value),
          csvEscape(row.window_start),
          csvEscape(row.window_end),
          csvEscape(row.notes),
        ].join(","),
      ),
    ];

    const absoluteOutputPath = resolve(outputPath);
    await mkdir(dirname(absoluteOutputPath), { recursive: true });
    await writeFile(absoluteOutputPath, `${csvLines.join("\n")}\n`, "utf8");

    console.log(
      JSON.stringify(
        {
          ok: true,
          output: absoluteOutputPath,
          windowStart: from.toISOString(),
          windowEnd: to.toISOString(),
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
