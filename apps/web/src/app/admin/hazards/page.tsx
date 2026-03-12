import Link from "next/link";
import { checkAuthReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { findAllSites } from "@/lib/repository/site.repository";
import { listHazards } from "@/lib/repository/hazard.repository";
import { closeHazardAction, createHazardAction } from "./actions";
import { redirect } from "next/navigation";
import { PageEmptyState } from "@/components/ui/page-state";
import { InlineCopilotPanel } from "../components/inline-copilot-panel";

export const metadata = {
  title: "Hazard Register | InductLite",
};

function riskChipClass(riskLevel: string): string {
  if (riskLevel === "CRITICAL") {
    return "border-red-500/45 bg-red-500/20 text-red-950 dark:text-red-100";
  }
  if (riskLevel === "HIGH") {
    return "border-amber-400/45 bg-amber-500/20 text-amber-900 dark:text-amber-100";
  }
  if (riskLevel === "MEDIUM") {
    return "border-cyan-400/35 bg-cyan-500/15 text-cyan-950 dark:text-cyan-100";
  }
  return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
}

function hazardStatusChipClass(status: string): string {
  if (status === "CLOSED") {
    return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
  }
  if (status === "ACTIVE") {
    return "border-amber-400/35 bg-amber-500/15 text-amber-900 dark:text-amber-100";
  }
  return "border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] text-secondary";
}

export default async function HazardsPage() {
  const auth = await checkAuthReadOnly();
  if (!auth.success) {
    if (auth.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  if (auth.user.role !== "ADMIN" && auth.user.role !== "SITE_MANAGER") {
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const [sites, hazardResult] = await Promise.all([
    findAllSites(context.companyId),
    listHazards(context.companyId, undefined, { pageSize: 100 }),
  ]);

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Hazard Register
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Track active hazards, controls, and close-out state across sites.
          </p>
        </div>
        <Link
          href="/admin/dashboard"
          className="text-sm font-semibold text-accent hover:underline"
        >
          Back to Dashboard
        </Link>
      </div>

      <InlineCopilotPanel
        companyId={context.companyId}
        prompt="Which hazard controls should we prioritize this week to reduce active site risk?"
        title="Hazard Triage Copilot"
      />

      <section className="surface-panel p-4">
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Add Hazard</h2>
        <form
          action={async (formData) => {
            "use server";
            await createHazardAction(null, formData);
          }}
          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          <label className="text-sm text-secondary">
            Site
            <select
              name="siteId"
              className="input mt-1"
              required
            >
              <option value="">Select site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-secondary">
            Risk Level
            <select
              name="riskLevel"
              defaultValue="MEDIUM"
              className="input mt-1"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </label>

          <label className="text-sm text-secondary md:col-span-2">
            Hazard Title
            <input
              name="title"
              type="text"
              maxLength={160}
              required
              className="input mt-1"
            />
          </label>

          <label className="text-sm text-secondary md:col-span-2">
            Description
            <textarea
              name="description"
              rows={3}
              className="input mt-1"
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="btn-primary"
            >
              Add Hazard
            </button>
          </div>
        </form>
      </section>

      <section className="surface-panel overflow-hidden">
        <div className="border-b border-[color:var(--border-soft)] px-4 py-3">
          <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
            Current Hazards
          </h2>
        </div>
        {hazardResult.items.length === 0 ? (
          <div className="p-4">
            <PageEmptyState
              title="No hazards recorded yet"
              description="Add a hazard above to start tracking controls and close-out actions."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
              <thead className="bg-[color:var(--bg-surface-strong)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                    Hazard
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                    Risk
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                    Identified
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
                {hazardResult.items.map((hazard) => (
                  <tr key={hazard.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                        {hazard.title}
                      </p>
                      {hazard.description && (
                        <p className="mt-1 text-xs text-muted">{hazard.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${riskChipClass(hazard.risk_level)}`}
                      >
                        {hazard.risk_level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${hazardStatusChipClass(hazard.status)}`}
                      >
                        {hazard.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary">
                      {hazard.identified_at.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {hazard.status !== "CLOSED" && (
                        <form
                          action={async () => {
                            "use server";
                            await closeHazardAction(hazard.id);
                          }}
                        >
                          <button
                            type="submit"
                            className="btn-secondary min-h-[36px] px-3 py-1.5 text-xs"
                          >
                            Close
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

