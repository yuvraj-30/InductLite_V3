import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { listContractors } from "@/lib/repository/contractor.repository";
import {
  listContractorRiskScores,
  listRiskScoreHistoryForScoreIds,
} from "@/lib/repository/risk-passport.repository";
import { getCompetencySummary } from "@/lib/repository/competency.repository";
import { findAllSites } from "@/lib/repository/site.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { PageWarningState } from "@/components/ui/page-state";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHeadCell,
  DataTableHeader,
  DataTableRow,
  DataTableScroll,
  DataTableShell,
} from "@/components/ui/data-table";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import {
  refreshAllRiskScoresAction,
  refreshSingleRiskScoreAction,
} from "./actions";

export const metadata = {
  title: "Risk Passport | InductLite",
};

interface RiskPassportPageProps {
  searchParams?: Promise<{ status?: string; message?: string }>;
}

function statusBannerClass(status: string | undefined): string {
  if (status === "ok") return "border-green-200 bg-green-50 text-green-800";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

function parseComponents(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function parseComponentNumber(
  components: Record<string, unknown>,
  key: string,
): number {
  const value = components[key];
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function formatTrend(delta: number | null): string {
  if (delta === null) return "-";
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}

function thresholdTone(threshold: string | null): StatusBadgeTone {
  if (!threshold) return "neutral";
  if (threshold === "HIGH") return "danger";
  if (threshold === "MEDIUM") return "warning";
  return "success";
}

export default async function RiskPassportPage({ searchParams }: RiskPassportPageProps) {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const params = (await searchParams) ?? {};
  const context = await requireAuthenticatedContextReadOnly();

  if (!isFeatureEnabled("RISK_PASSPORT_V1")) {
    return (
      <div className="space-y-6 p-3 sm:p-4">
        <div className="surface-panel-strong p-5">
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Contractor Risk Passport
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Score contractor risk across incidents, document expiry, permits, and prequalification outcomes.
          </p>
        </div>
        <PageWarningState
          title="Risk passport is disabled by rollout flag."
          description="CONTROL_ID: FLAG-ROLLOUT-001."
        />
      </div>
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "RISK_PASSPORT_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="space-y-6 p-3 sm:p-4">
          <div className="surface-panel-strong p-5">
            <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
              Contractor Risk Passport
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Score contractor risk across incidents, document expiry, permits, and prequalification outcomes.
            </p>
          </div>
          <PageWarningState
            title="Risk passport is not enabled for this plan."
            description="CONTROL_ID: PLAN-ENTITLEMENT-001."
          />
        </div>
      );
    }
    throw error;
  }

  const [sites, contractorPage, riskScores, competencySummary] = await Promise.all([
    findAllSites(context.companyId),
    listContractors(context.companyId, { isActive: true }, { page: 1, pageSize: 500 }),
    listContractorRiskScores(context.companyId, { limit: 500 }),
    getCompetencySummary(context.companyId),
  ]);

  const contractors = contractorPage.items;
  const trendSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const riskHistory = await listRiskScoreHistoryForScoreIds(context.companyId, {
    contractor_risk_score_ids: riskScores.map((score) => score.id),
    since: trendSince,
    limit: 10000,
  });

  const historyByScoreId = new Map<string, typeof riskHistory>();
  for (const row of riskHistory) {
    const bucket = historyByScoreId.get(row.contractor_risk_score_id) ?? [];
    bucket.push(row);
    historyByScoreId.set(row.contractor_risk_score_id, bucket);
  }

  const trendByScoreId = new Map<string, number | null>();
  for (const score of riskScores) {
    const history = historyByScoreId.get(score.id) ?? [];
    if (history.length === 0) {
      trendByScoreId.set(score.id, null);
      continue;
    }
    const oldest = history[history.length - 1] ?? null;
    trendByScoreId.set(
      score.id,
      oldest ? score.current_score - oldest.score : null,
    );
  }

  const siteSummary = new Map<
    string,
    {
      siteName: string;
      count: number;
      totalScore: number;
      high: number;
      medium: number;
      low: number;
    }
  >();
  for (const score of riskScores) {
    const siteName =
      sites.find((site) => site.id === score.site_id)?.name ??
      (score.site_id ? score.site_id : "All sites");
    const key = score.site_id ?? "__all__";
    const current = siteSummary.get(key) ?? {
      siteName,
      count: 0,
      totalScore: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    current.count += 1;
    current.totalScore += score.current_score;
    if (score.threshold_state === "HIGH") current.high += 1;
    else if (score.threshold_state === "MEDIUM") current.medium += 1;
    else current.low += 1;
    siteSummary.set(key, current);
  }
  const highRiskCount = riskScores.filter((score) => score.threshold_state === "HIGH").length;
  const mediumRiskCount = riskScores.filter(
    (score) => score.threshold_state === "MEDIUM",
  ).length;
  const lowRiskCount = riskScores.filter((score) => score.threshold_state === "LOW").length;

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_320px]">
          <div>
            <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
              Contractor Risk Passport
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Score contractor risk across incidents, expiring documents, permits, and prequalification outcomes.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Profiles
                </p>
                <p className="mt-2 text-3xl font-black text-[color:var(--text-primary)]">
                  {riskScores.length}
                </p>
              </div>
              <div className="rounded-xl border border-red-400/35 bg-red-500/12 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-red-950 dark:text-red-100">
                  High risk
                </p>
                <p className="mt-2 text-3xl font-black text-red-950 dark:text-red-100">
                  {highRiskCount}
                </p>
              </div>
              <div className="rounded-xl border border-amber-400/35 bg-amber-500/12 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-900 dark:text-amber-100">
                  Medium risk
                </p>
                <p className="mt-2 text-3xl font-black text-amber-900 dark:text-amber-100">
                  {mediumRiskCount}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/12 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-950 dark:text-emerald-100">
                  Low risk
                </p>
                <p className="mt-2 text-3xl font-black text-emerald-900 dark:text-emerald-100">
                  {lowRiskCount}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
              Priority
            </p>
            <p className="mt-3 text-sm text-secondary">
              Focus on contractors with high thresholds or upward 30-day trends, then clear the document and permit components driving that score.
            </p>
            <div className="mt-4 rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-indigo-950 dark:text-indigo-100">
                Competency pressure
              </p>
              <p className="mt-2 text-sm text-indigo-950 dark:text-indigo-100">
                {competencySummary.expiring} expiring certifications and {competencySummary.pending_verification} pending checks may affect worker clearance.
              </p>
              <a
                href="/admin/competency"
                className="mt-3 inline-flex min-h-[36px] items-center rounded-lg border border-indigo-300/45 bg-white/70 px-3 py-2 text-xs font-semibold text-indigo-950 hover:bg-white dark:bg-indigo-950/20 dark:text-indigo-100"
              >
                Open competency matrix
              </a>
            </div>
          </div>
        </div>
      </div>

      {params.message ? (
        <div className={`rounded-lg border p-3 text-sm ${statusBannerClass(params.status)}`}>
          {params.message}
        </div>
      ) : null}

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Refresh Scores
        </h2>
        <form action={refreshAllRiskScoresAction} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm text-secondary">
            Site Scope
            <select name="siteId" className="input mt-1 min-w-[220px]">
              <option value="">All sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="btn-primary"
          >
            Refresh All
          </button>
        </form>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Site Risk Trend (30 Days)
        </h2>
        <DataTableShell className="mt-3">
          <DataTableScroll>
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHeadCell>Site</DataTableHeadCell>
                  <DataTableHeadCell>Profiles</DataTableHeadCell>
                  <DataTableHeadCell>Avg Score</DataTableHeadCell>
                  <DataTableHeadCell>High</DataTableHeadCell>
                  <DataTableHeadCell>Medium</DataTableHeadCell>
                  <DataTableHeadCell>Low</DataTableHeadCell>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {siteSummary.size === 0 ? (
                  <DataTableEmptyRow colSpan={6}>
                    No site risk data yet.
                  </DataTableEmptyRow>
                ) : (
                  Array.from(siteSummary.values())
                    .sort((a, b) => a.siteName.localeCompare(b.siteName))
                    .map((row) => (
                      <DataTableRow key={row.siteName}>
                        <DataTableCell>{row.siteName}</DataTableCell>
                        <DataTableCell>{row.count}</DataTableCell>
                        <DataTableCell>
                          {Math.round(row.totalScore / Math.max(1, row.count))}
                        </DataTableCell>
                        <DataTableCell>{row.high}</DataTableCell>
                        <DataTableCell>{row.medium}</DataTableCell>
                        <DataTableCell>{row.low}</DataTableCell>
                      </DataTableRow>
                    ))
                )}
              </DataTableBody>
            </DataTable>
          </DataTableScroll>
        </DataTableShell>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Current Risk Scores
        </h2>
        <DataTableShell className="mt-3">
          <DataTableScroll>
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHeadCell>Contractor</DataTableHeadCell>
                  <DataTableHeadCell>Site</DataTableHeadCell>
                  <DataTableHeadCell>Score</DataTableHeadCell>
                  <DataTableHeadCell>Threshold</DataTableHeadCell>
                  <DataTableHeadCell>Trend (30d)</DataTableHeadCell>
                  <DataTableHeadCell>Last Calculated</DataTableHeadCell>
                  <DataTableHeadCell>Components</DataTableHeadCell>
                  <DataTableHeadCell className="text-right">Action</DataTableHeadCell>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {riskScores.length === 0 ? (
                  <DataTableEmptyRow colSpan={8}>
                    No risk scores calculated yet.
                  </DataTableEmptyRow>
                ) : (
                  riskScores.map((score) => {
                    const components = parseComponents(score.components);
                    const contractorName =
                      contractors.find((contractor) => contractor.id === score.contractor_id)?.name ??
                      score.contractor_id;
                    const siteName =
                      sites.find((site) => site.id === score.site_id)?.name ??
                      (score.site_id ? score.site_id : "All sites");

                    return (
                      <DataTableRow key={score.id}>
                        <DataTableCell>{contractorName}</DataTableCell>
                        <DataTableCell>{siteName}</DataTableCell>
                        <DataTableCell className="font-semibold text-[color:var(--text-primary)]">
                          {score.current_score}
                        </DataTableCell>
                        <DataTableCell>
                          <StatusBadge tone={thresholdTone(score.threshold_state)}>
                            {score.threshold_state}
                          </StatusBadge>
                        </DataTableCell>
                        <DataTableCell>{formatTrend(trendByScoreId.get(score.id) ?? null)}</DataTableCell>
                        <DataTableCell>
                          {score.last_calculated_at
                            ? score.last_calculated_at.toLocaleString("en-NZ")
                            : "-"}
                        </DataTableCell>
                        <DataTableCell className="text-xs">
                          <div className="space-y-1">
                            <div>
                              docs expired: {parseComponentNumber(components, "expired_documents")} |
                              docs expiring(30d):{" "}
                              {parseComponentNumber(components, "expiring_documents_30d")}
                            </div>
                            <div>
                              permit breaches: {parseComponentNumber(components, "permit_breaches")} |
                              prequal penalty:{" "}
                              {parseComponentNumber(components, "prequalification_penalty")}
                            </div>
                            <div>
                              incidents(180d): {parseComponentNumber(components, "incident_reports_180d")} |
                              quiz failures(180d):{" "}
                              {parseComponentNumber(components, "quiz_failures_180d")}
                            </div>
                          </div>
                        </DataTableCell>
                        <DataTableCell className="text-right">
                          <form action={refreshSingleRiskScoreAction}>
                            <input type="hidden" name="contractorId" value={score.contractor_id} />
                            <input type="hidden" name="siteId" value={score.site_id ?? ""} />
                            <button
                              type="submit"
                              className="rounded border border-indigo-300 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                            >
                              Refresh
                            </button>
                          </form>
                        </DataTableCell>
                      </DataTableRow>
                    );
                  })
                )}
              </DataTableBody>
            </DataTable>
          </DataTableScroll>
        </DataTableShell>
      </section>
    </div>
  );
}

