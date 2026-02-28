import Link from "next/link";
import { checkAuthReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { findAllSites } from "@/lib/repository/site.repository";
import { listHazards } from "@/lib/repository/hazard.repository";
import { closeHazardAction, createHazardAction } from "./actions";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Hazard Register | InductLite",
};

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
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hazard Register</h1>
          <p className="mt-1 text-gray-600">
            Track active hazards, controls, and close-out state across sites.
          </p>
        </div>
        <Link
          href="/admin/dashboard"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Back to Dashboard
        </Link>
      </div>

      <section className="mb-8 rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Add Hazard</h2>
        <form
          action={async (formData) => {
            "use server";
            await createHazardAction(null, formData);
          }}
          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          <label className="text-sm text-gray-700">
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

          <label className="text-sm text-gray-700">
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

          <label className="text-sm text-gray-700 md:col-span-2">
            Hazard Title
            <input
              name="title"
              type="text"
              maxLength={160}
              required
              className="input mt-1"
            />
          </label>

          <label className="text-sm text-gray-700 md:col-span-2">
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
              className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add Hazard
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Current Hazards</h2>
        </div>
        {hazardResult.items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No hazards recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Hazard
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Risk
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Identified
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {hazardResult.items.map((hazard) => (
                  <tr key={hazard.id}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{hazard.title}</p>
                      {hazard.description && (
                        <p className="mt-1 text-xs text-gray-500">{hazard.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{hazard.risk_level}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{hazard.status}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
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
