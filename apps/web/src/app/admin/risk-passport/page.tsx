import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { listContractors } from "@/lib/repository/contractor.repository";
import { listContractorRiskScores } from "@/lib/repository/risk-passport.repository";
import { findAllSites } from "@/lib/repository/site.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
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
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Contractor Risk Passport</h1>
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Risk passport is disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001).
        </p>
      </div>
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "RISK_PASSPORT_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">Contractor Risk Passport</h1>
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Risk passport is not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001).
          </p>
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

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contractor Risk Passport</h1>
        <p className="mt-1 text-sm text-gray-600">
          Score contractor risk across incidents, document expiry, permits, and prequalification outcomes.
        </p>
      </div>

      {params.message ? (
        <div className={`rounded-lg border p-3 text-sm ${statusBannerClass(params.status)}`}>
          {params.message}
        </div>
      ) : null}

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Refresh Scores
        </h2>
        <form action={refreshAllRiskScoresAction} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm text-gray-700">
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
            className="min-h-[40px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Refresh All
          </button>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Current Risk Scores
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Contractor</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Site</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Score</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Threshold</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Components</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {riskScores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-sm text-gray-500">No risk scores calculated yet.</td>
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
                      <td className="px-3 py-3 text-sm text-gray-700">{contractorName}</td>
                      <td className="px-3 py-3 text-sm text-gray-700">{siteName}</td>
                      <td className="px-3 py-3 text-sm font-semibold text-gray-900">{score.current_score}</td>
                      <td className="px-3 py-3 text-sm text-gray-700">{score.threshold_state}</td>
                      <td className="px-3 py-3 text-xs text-gray-600">
                        <code className="inline-block max-w-[20rem] truncate rounded bg-gray-100 px-1 py-0.5">
                          {JSON.stringify(components)}
                        </code>
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
