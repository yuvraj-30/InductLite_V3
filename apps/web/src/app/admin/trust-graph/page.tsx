import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { findAllSites } from "@/lib/repository/site.repository";
import { buildContractorTrustGraph } from "@/lib/differentiation/trust-graph";
import { PageWarningState } from "@/components/ui/page-state";

export const metadata = {
  title: "Contractor Trust Graph | InductLite",
};

interface TrustGraphPageProps {
  searchParams?: Promise<{ siteId?: string }>;
}

export default async function TrustGraphPage({ searchParams }: TrustGraphPageProps) {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  if (!isFeatureEnabled("RISK_PASSPORT_V1")) {
    return (
      <div className="space-y-6 p-3 sm:p-4">
        <div className="surface-panel-strong p-5">
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Contractor Trust Graph
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Combined internal risk + external prequalification signals with confidence and reason codes.
          </p>
        </div>
        <PageWarningState
          title="Trust graph is disabled by rollout flag."
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
              Contractor Trust Graph
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Combined internal risk + external prequalification signals with confidence and reason codes.
            </p>
          </div>
          <PageWarningState
            title="Trust graph is not enabled for this plan."
            description="CONTROL_ID: PLAN-ENTITLEMENT-001."
          />
        </div>
      );
    }
    throw error;
  }

  const params = (await searchParams) ?? {};
  const [sites, nodes] = await Promise.all([
    findAllSites(context.companyId),
    buildContractorTrustGraph({
      companyId: context.companyId,
      siteId: params.siteId || undefined,
    }),
  ]);

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div>
        <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">Contractor Trust Graph</h1>
        <p className="mt-1 text-sm text-secondary">
          Combined internal risk + external prequalification signals with confidence and reason codes.
        </p>
      </div>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Scope
        </h2>
        <form className="mt-3 flex flex-wrap gap-2" method="get">
          <select name="siteId" className="input min-w-[220px]" defaultValue={params.siteId ?? ""}>
            <option value="">All sites</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded border border-[color:var(--border-soft)] px-3 py-2 text-sm font-semibold text-secondary hover:bg-[color:var(--bg-surface-strong)]"
          >
            Apply
          </button>
        </form>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Trust Nodes
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Contractor
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Trust Score
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Confidence
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Components
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Reasons
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {nodes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-sm text-muted">
                    No contractor trust nodes available.
                  </td>
                </tr>
              ) : (
                nodes.map((node) => (
                  <tr key={node.contractorId}>
                    <td className="px-3 py-3 text-sm text-secondary">{node.contractorName}</td>
                    <td className="px-3 py-3 text-sm font-semibold text-[color:var(--text-primary)]">
                      {node.trustScore}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">{node.confidence}%</td>
                    <td className="px-3 py-3 text-xs text-secondary">
                      internal={node.components.internalRiskScore ?? "-"} | external=
                      {node.components.externalPrequalScore ?? "-"} | status=
                      {node.components.prequalStatus ?? "-"}
                    </td>
                    <td className="px-3 py-3 text-xs text-secondary">
                      {node.reasons.join("; ")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

