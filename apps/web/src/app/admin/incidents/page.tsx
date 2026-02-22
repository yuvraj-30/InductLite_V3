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
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incident & Near-Miss Register</h1>
          <p className="mt-1 text-gray-600">
            Capture field incidents with optional sign-in linkage for follow-up investigations.
          </p>
        </div>
        <Link
          href="/admin/live-register"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Back to Live Register
        </Link>
      </div>

      <section className="mb-8 rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Log Incident</h2>
        <form
          action={async (formData) => {
            "use server";
            await createIncidentReportAction(null, formData);
          }}
          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          <label className="text-sm text-gray-700">
            Site
            <select
              name="siteId"
              required
              defaultValue={defaultSiteId}
              className="mt-1 block min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-700">
            Linked Sign-In Record ID (optional)
            <input
              name="signInRecordId"
              type="text"
              defaultValue={params.signInId ?? ""}
              className="mt-1 block min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="cuid from live register"
            />
          </label>

          <label className="text-sm text-gray-700">
            Type
            <select
              name="incidentType"
              defaultValue="INCIDENT"
              className="mt-1 block min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="INCIDENT">Incident</option>
              <option value="NEAR_MISS">Near miss</option>
            </select>
          </label>

          <label className="text-sm text-gray-700">
            Severity
            <select
              name="severity"
              defaultValue="MEDIUM"
              className="mt-1 block min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </label>

          <label className="text-sm text-gray-700">
            Occurred At
            <input
              name="occurredAt"
              type="datetime-local"
              defaultValue={formatDateTimeLocal(new Date())}
              className="mt-1 block min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm text-gray-700 md:col-span-2">
            Title
            <input
              name="title"
              type="text"
              required
              maxLength={160}
              className="mt-1 block min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Brief summary of what happened"
            />
          </label>

          <label className="text-sm text-gray-700 md:col-span-2">
            Description
            <textarea
              name="description"
              rows={3}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm text-gray-700 md:col-span-2">
            Immediate Actions Taken
            <textarea
              name="immediateActions"
              rows={2}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Log Incident
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Recent Reports</h2>
        </div>
        {incidents.items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No incident reports logged yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Report
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Site
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Occurred
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {incidents.items.map((incident) => (
                  <tr key={incident.id}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{incident.title}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {incident.incident_type === "NEAR_MISS" ? "Near miss" : "Incident"}
                        {incident.sign_in_record_id
                          ? ` | Sign-in: ${incident.sign_in_record_id.slice(0, 8)}...`
                          : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {siteById.get(incident.site_id) ?? "Unknown site"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{incident.severity}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{incident.status}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
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
                            className="min-h-[36px] rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
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

