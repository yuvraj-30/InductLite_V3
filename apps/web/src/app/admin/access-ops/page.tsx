import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import {
  listAccessDecisionTraces,
  listHardwareOutageEvents,
} from "@/lib/repository/hardware-trace.repository";
import { findAllSites } from "@/lib/repository/site.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { resolveHardwareOutageAction } from "./actions";

export const metadata = {
  title: "Access Operations | InductLite",
};

interface AccessOpsPageProps {
  searchParams?: Promise<{ site?: string; status?: string; message?: string }>;
}

function statusBannerClass(status: string | undefined): string {
  if (status === "ok") return "border-green-200 bg-green-50 text-green-800";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

async function ensureAccessOpsFeature(companyId: string): Promise<boolean> {
  try {
    await assertCompanyFeatureEnabled(companyId, "HARDWARE_ACCESS");
    return true;
  } catch (error) {
    if (!(error instanceof EntitlementDeniedError)) throw error;
  }

  try {
    await assertCompanyFeatureEnabled(companyId, "GATEWAY_TRACE_V1");
    return true;
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return false;
    }
    throw error;
  }
}

export default async function AccessOpsPage({ searchParams }: AccessOpsPageProps) {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const params = (await searchParams) ?? {};
  const context = await requireAuthenticatedContextReadOnly();

  const enabled = await ensureAccessOpsFeature(context.companyId);
  if (!enabled) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Gate & Access Operations</h1>
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Access operation traceability is not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001).
        </p>
      </div>
    );
  }

  const [sites, traces, outages] = await Promise.all([
    findAllSites(context.companyId),
    listAccessDecisionTraces(context.companyId, {
      site_id: params.site || undefined,
      limit: 250,
    }),
    listHardwareOutageEvents(context.companyId, {
      site_id: params.site || undefined,
      limit: 100,
    }),
  ]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gate & Access Operations</h1>
        <p className="mt-1 text-sm text-gray-600">
          Correlate gate decisions end-to-end and track hardware outages with fallback continuity.
        </p>
      </div>

      {params.message ? (
        <div className={`rounded-lg border p-3 text-sm ${statusBannerClass(params.status)}`}>
          {params.message}
        </div>
      ) : null}

      <section className="rounded-lg border bg-white p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-gray-700">
            Site Scope
            <select name="site" defaultValue={params.site ?? ""} className="input mt-1 min-w-[240px]">
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
            Apply Filter
          </button>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Access Decision Trace
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Requested</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Site</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Correlation</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Decision</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Latency (ms)</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Fallback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {traces.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-sm text-gray-500">No access decision traces yet.</td>
                </tr>
              ) : (
                traces.map((trace) => {
                  const latencyMs =
                    trace.decided_at && trace.requested_at
                      ? trace.decided_at.getTime() - trace.requested_at.getTime()
                      : null;
                  return (
                    <tr key={trace.id}>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        {trace.requested_at.toLocaleString("en-NZ")}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        {sites.find((site) => site.id === trace.site_id)?.name ?? trace.site_id}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600">
                        <code>{trace.correlation_id}</code>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">{trace.decision_status}</td>
                      <td className="px-3 py-3 text-sm text-gray-700">{latencyMs ?? "-"}</td>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        {trace.fallback_mode ? "Yes" : "No"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Hardware Outage Events
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Started</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Site</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Provider</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Severity</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Reason</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {outages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-sm text-gray-500">No hardware outage events recorded.</td>
                </tr>
              ) : (
                outages.map((outage) => (
                  <tr key={outage.id}>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {outage.started_at.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {sites.find((site) => site.id === outage.site_id)?.name ??
                        (outage.site_id ? outage.site_id : "All sites")}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{outage.provider ?? "-"}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{outage.severity}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{outage.reason}</td>
                    <td className="px-3 py-3 text-right">
                      {outage.resolved_at ? (
                        <span className="text-xs text-gray-500">
                          Resolved {outage.resolved_at.toLocaleString("en-NZ")}
                        </span>
                      ) : (
                        <form action={resolveHardwareOutageAction}>
                          <input type="hidden" name="outageId" value={outage.id} />
                          <button
                            type="submit"
                            className="rounded border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                          >
                            Mark Resolved
                          </button>
                        </form>
                      )}
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
