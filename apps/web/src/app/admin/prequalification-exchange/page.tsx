import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { findAllSites } from "@/lib/repository/site.repository";
import { listCommunicationEvents } from "@/lib/repository/communication.repository";
import { PageWarningState } from "@/components/ui/page-state";
import { importPrequalificationExchangeAction } from "./actions";

export const metadata = {
  title: "Prequalification Exchange | InductLite",
};

export default async function PrequalificationExchangePage() {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  if (!isFeatureEnabled("PERMITS_V1")) {
    return (
      <div className="space-y-6 p-3 sm:p-4">
        <div className="surface-panel-strong p-5">
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Prequalification Exchange
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Import external prequalification snapshots and map to contractor profiles.
          </p>
        </div>
        <PageWarningState
          title="Prequalification exchange is disabled by rollout flag."
          description="CONTROL_ID: FLAG-ROLLOUT-001."
        />
      </div>
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "PREQUALIFICATION_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="space-y-6 p-3 sm:p-4">
          <div className="surface-panel-strong p-5">
            <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
              Prequalification Exchange
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Import external prequalification snapshots and map to contractor profiles.
            </p>
          </div>
          <PageWarningState
            title="Prequalification exchange is not enabled for this plan."
            description="CONTROL_ID: PLAN-ENTITLEMENT-001."
          />
        </div>
      );
    }
    throw error;
  }

  const [sites, events] = await Promise.all([
    findAllSites(context.companyId),
    listCommunicationEvents(context.companyId, { event_type: "prequal.exchange.import", limit: 100 }),
  ]);

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div>
        <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">Prequalification Exchange</h1>
        <p className="mt-1 text-sm text-secondary">
          Import external prequalification snapshots (Totika/SiteWise style) and map to contractor profiles.
        </p>
      </div>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Import Snapshot
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await importPrequalificationExchangeAction(null, formData);
          }}
          className="mt-3 grid gap-3"
        >
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm text-secondary">
              Provider
              <select name="provider" className="input mt-1" defaultValue="TOTIKA">
                <option value="TOTIKA">Totika</option>
                <option value="SITEWISE">SiteWise</option>
              </select>
            </label>
            <label className="text-sm text-secondary">
              Site scope (optional)
              <select name="siteId" className="input mt-1">
                <option value="">All sites</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-sm text-secondary">
            Payload JSON
            <textarea
              name="payloadJson"
              required
              rows={10}
              className="input mt-1 min-h-[240px] font-mono text-xs"
              placeholder='{"profiles":[{"externalId":"totika-1","contractorName":"Acme Electrical","contractorEmail":"ops@acme.nz","status":"approved","score":88,"expiresAt":"2026-12-01T00:00:00+13:00"}]}'
            />
          </label>
          <div>
            <button
              type="submit"
              className="btn-primary"
            >
              Import Exchange Data
            </button>
          </div>
        </form>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Recent Imports
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Timestamp
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Summary
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-sm text-muted">
                    No exchange imports yet.
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id}>
                    <td className="px-3 py-3 text-sm text-secondary">
                      {event.created_at.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">{event.status ?? "-"}</td>
                    <td className="px-3 py-3 text-xs text-secondary">
                      <pre className="whitespace-pre-wrap break-all">
                        {JSON.stringify(event.payload ?? {}, null, 2)}
                      </pre>
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

