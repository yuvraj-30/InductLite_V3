import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { listContractors } from "@/lib/repository/contractor.repository";
import {
  listContractorRiskScores,
  listRiskScoreHistoryForScoreIds,
} from "@/lib/repository/risk-passport.repository";
import { findAllSites } from "@/lib/repository/site.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { PageWarningState } from "@/components/ui/page-state";
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

  const [sites, contractorPage, riskScores] = await Promise.all([
    findAllSites(context.companyId),
    listContractors(context.companyId, { isActive: true }, { page: 1, pageSize: 500 }),
    listContractorRiskScores(context.companyId, { limit: 500 }),
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

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div>
        <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">Contractor Risk Passport</h1>
        <p className="mt-1 text-sm text-secondary">
          Score contractor risk across incidents, document expiry, permits, and prequalification outcomes.
        </p>
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
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Site</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Profiles</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Avg Score</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">High</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Medium</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Low</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {siteSummary.size === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-sm text-muted">No site risk data yet.</td>
                </tr>
              ) : (
                Array.from(siteSummary.values())
                  .sort((a, b) => a.siteName.localeCompare(b.siteName))
                  .map((row) => (
                    <tr key={row.siteName}>
                      <td className="px-3 py-3 text-sm text-secondary">{row.siteName}</td>
                      <td className="px-3 py-3 text-sm text-secondary">{row.count}</td>
                      <td className="px-3 py-3 text-sm text-secondary">
                        {Math.round(row.totalScore / Math.max(1, row.count))}
                      </td>
                      <td className="px-3 py-3 text-sm text-secondary">{row.high}</td>
                      <td className="px-3 py-3 text-sm text-secondary">{row.medium}</td>
                      <td className="px-3 py-3 text-sm text-secondary">{row.low}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Current Risk Scores
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Contractor</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Site</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Score</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Threshold</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Trend (30d)</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Last Calculated</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Components</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {riskScores.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-3 text-sm text-muted">No risk scores calculated yet.</td>
                </tr>
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
                    <tr key={score.id}>
                      <td className="px-3 py-3 text-sm text-secondary">{contractorName}</td>
                      <td className="px-3 py-3 text-sm text-secondary">{siteName}</td>
                      <td className="px-3 py-3 text-sm font-semibold text-[color:var(--text-primary)]">{score.current_score}</td>
                      <td className="px-3 py-3 text-sm text-secondary">{score.threshold_state}</td>
                      <td className="px-3 py-3 text-sm text-secondary">
                        {formatTrend(trendByScoreId.get(score.id) ?? null)}
                      </td>
                      <td className="px-3 py-3 text-sm text-secondary">
                        {score.last_calculated_at
                          ? score.last_calculated_at.toLocaleString("en-NZ")
                          : "-"}
                      </td>
                      <td className="px-3 py-3 text-xs text-secondary">
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
                      </td>
                      <td className="px-3 py-3 text-right">
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

