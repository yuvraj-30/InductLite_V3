import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAuthReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { findAllSites } from "@/lib/repository/site.repository";
import { listIncidentReports } from "@/lib/repository/incident.repository";
import {
  createIncidentReportAction,
  resolveIncidentReportAction,
} from "./actions";
import { PageEmptyState } from "@/components/ui/page-state";
import { InlineCopilotPanel } from "../components/inline-copilot-panel";

export const metadata = {
  title: "Incidents | InductLite",
};

interface IncidentsPageProps {
  searchParams: Promise<{ site?: string; signInId?: string }>;
}

function formatDateTimeLocal(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function severityChipClass(severity: string): string {
  if (severity === "CRITICAL") {
    return "border-red-500/45 bg-red-500/20 text-red-950 dark:text-red-100";
  }
  if (severity === "HIGH") {
    return "border-amber-400/45 bg-amber-500/20 text-amber-900 dark:text-amber-100";
  }
  if (severity === "MEDIUM") {
    return "border-cyan-400/35 bg-cyan-500/15 text-cyan-950 dark:text-cyan-100";
  }
  return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
}

function incidentStatusChipClass(status: string): string {
  if (status === "CLOSED") {
    return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
  }
  if (status === "IN_PROGRESS") {
    return "border-cyan-400/35 bg-cyan-500/15 text-cyan-950 dark:text-cyan-100";
  }
  return "border-amber-400/35 bg-amber-500/15 text-amber-900 dark:text-amber-100";
}

export default async function IncidentsPage({ searchParams }: IncidentsPageProps) {
  const auth = await checkAuthReadOnly();
  if (!auth.success) {
    if (auth.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  if (auth.user.role !== "ADMIN" && auth.user.role !== "SITE_MANAGER") {
    redirect("/unauthorized");
  }

  const params = await searchParams;
  const context = await requireAuthenticatedContextReadOnly();
  const [sites, incidents] = await Promise.all([
    findAllSites(context.companyId),
    listIncidentReports(context.companyId, undefined, { pageSize: 100 }),
  ]);

  const siteById = new Map(sites.map((site) => [site.id, site.name]));
  const defaultSiteId =
    params.site && siteById.has(params.site)
      ? params.site
      : (sites[0]?.id ?? "");

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Incident & Near-Miss Register
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Capture field incidents with optional sign-in linkage for follow-up investigations.
          </p>
        </div>
        <Link
          href="/admin/live-register"
          className="text-sm font-semibold text-accent hover:underline"
        >
          Back to Live Register
        </Link>
      </div>

      <InlineCopilotPanel
        companyId={context.companyId}
        prompt="What actions should we prioritize to close open incident investigations safely and quickly?"
        title="Incident Response Copilot"
      />

      <section className="surface-panel p-4">
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Log Incident</h2>
        <form
          action={async (formData) => {
            "use server";
            await createIncidentReportAction(null, formData);
          }}
          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          <label className="text-sm text-secondary">
            Site
            <select
              name="siteId"
              required
              defaultValue={defaultSiteId}
              className="input mt-1"
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
            Linked Sign-In Record ID (optional)
            <input
              name="signInRecordId"
              type="text"
              defaultValue={params.signInId ?? ""}
              className="input mt-1"
              placeholder="cuid from live register"
            />
          </label>

          <label className="text-sm text-secondary">
            Type
            <select
              name="incidentType"
              defaultValue="INCIDENT"
              className="input mt-1"
            >
              <option value="INCIDENT">Incident</option>
              <option value="NEAR_MISS">Near miss</option>
            </select>
          </label>

          <label className="text-sm text-secondary">
            Severity
            <select
              name="severity"
              defaultValue="MEDIUM"
              className="input mt-1"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </label>

          <label className="text-sm text-secondary">
            Occurred At
            <input
              name="occurredAt"
              type="datetime-local"
              defaultValue={formatDateTimeLocal(new Date())}
              className="input mt-1"
            />
          </label>

          <label className="text-sm text-secondary">
            WorkSafe Notified At (optional)
            <input
              name="worksafeNotifiedAt"
              type="datetime-local"
              className="input mt-1"
            />
          </label>

          <label className="text-sm text-secondary md:col-span-2">
            Title
            <input
              name="title"
              type="text"
              required
              maxLength={160}
              className="input mt-1"
              placeholder="Brief summary of what happened"
            />
          </label>

          <label className="text-sm text-secondary md:col-span-2">
            WorkSafe Reference Number (optional)
            <input
              name="worksafeReferenceNumber"
              type="text"
              maxLength={120}
              className="input mt-1"
              placeholder="e.g. WS-NOTIFY-2026-0001"
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

          <label className="flex items-center gap-2 text-sm text-secondary md:col-span-2">
            <input
              name="isNotifiable"
              type="checkbox"
              value="true"
              className="h-4 w-4 rounded border-[color:var(--border-soft)]"
            />
            This is a notifiable event
          </label>

          <label className="flex items-center gap-2 text-sm text-secondary md:col-span-2">
            <input
              name="legalHold"
              type="checkbox"
              value="true"
              className="h-4 w-4 rounded border-[color:var(--border-soft)]"
            />
            Apply legal hold (exclude from automated retention purge)
          </label>

          <label className="text-sm text-secondary md:col-span-2">
            Immediate Actions Taken
            <textarea
              name="immediateActions"
              rows={2}
              className="input mt-1"
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="btn-primary"
            >
              Log Incident
            </button>
          </div>
        </form>
      </section>

      <section className="surface-panel overflow-hidden">
        <div className="border-b border-[color:var(--border-soft)] px-4 py-3">
          <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Recent Reports</h2>
        </div>
        {incidents.items.length === 0 ? (
          <div className="p-4">
            <PageEmptyState
              title="No incident reports logged yet"
              description="Use the Log Incident form above to capture the first report."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
              <thead className="bg-[color:var(--bg-surface-strong)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                    Report
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                    Site
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                    Occurred
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
                {incidents.items.map((incident) => (
                  <tr key={incident.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                        {incident.title}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {incident.incident_type === "NEAR_MISS" ? "Near miss" : "Incident"}
                        {incident.sign_in_record_id
                          ? ` | Sign-in: ${incident.sign_in_record_id.slice(0, 8)}...`
                          : ""}
                        {incident.is_notifiable ? " | Notifiable" : ""}
                        {incident.worksafe_reference_number
                          ? ` | Ref: ${incident.worksafe_reference_number}`
                          : ""}
                        {incident.legal_hold ? " | Legal hold" : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary">
                      {siteById.get(incident.site_id) ?? "Unknown site"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${severityChipClass(incident.severity)}`}
                      >
                        {incident.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${incidentStatusChipClass(incident.status)}`}
                      >
                        {incident.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary">
                      {incident.occurred_at.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {incident.status !== "CLOSED" && (
                        <form
                          action={async () => {
                            "use server";
                            await resolveIncidentReportAction(incident.id);
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
