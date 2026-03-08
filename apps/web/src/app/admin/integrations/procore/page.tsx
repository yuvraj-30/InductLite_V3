import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { findAllSites, findSiteById } from "@/lib/repository/site.repository";
import { listCommunicationEvents } from "@/lib/repository/communication.repository";
import { parseProcoreConnectorConfig } from "@/lib/integrations/procore/config";
import { queueProcoreSyncAction, updateProcoreConnectorAction } from "./actions";

export const metadata = {
  title: "Procore Connector | InductLite",
};

export default async function ProcoreConnectorPage() {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  if (!isFeatureEnabled("PERMITS_V1")) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Procore Connector</h1>
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Connector workflows are disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001).
        </p>
      </div>
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "LMS_CONNECTOR");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">Procore Connector</h1>
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Connector workflows are not enabled for this plan (CONTROL_ID:
            PLAN-ENTITLEMENT-001).
          </p>
        </div>
      );
    }
    throw error;
  }

  const [sites, events] = await Promise.all([
    findAllSites(context.companyId),
    listCommunicationEvents(context.companyId, { limit: 200 }),
  ]);
  const siteDetails = (
    await Promise.all(
      sites.map((site) => findSiteById(context.companyId, site.id)),
    )
  ).filter((site): site is NonNullable<typeof site> => Boolean(site));

  const connectorEvents = events.filter((event) =>
    event.event_type.startsWith("procore."),
  );
  if (sites.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Procore Connector</h1>
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Create a site first to configure the connector.
        </p>
      </div>
    );
  }

  const activeSite = siteDetails.find((site) =>
    parseProcoreConnectorConfig(site.lms_connector).enabled,
  );
  const initial = parseProcoreConnectorConfig(activeSite?.lms_connector);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Procore Connector</h1>
        <p className="mt-1 text-sm text-gray-600">
          Configure named Procore sync and run outbound sign-in/permit snapshots.
        </p>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Connector Configuration
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await updateProcoreConnectorAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-2"
        >
          <label className="text-sm text-gray-700">
            Site
            <select
              name="siteId"
              className="input mt-1"
              defaultValue={activeSite?.id ?? sites[0]?.id ?? ""}
              required
            >
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Endpoint URL
            <input
              name="endpointUrl"
              className="input mt-1"
              defaultValue={initial.endpointUrl ?? ""}
              placeholder="https://api.procore.example/sync"
              required
            />
          </label>
          <label className="text-sm text-gray-700">
            Project ID
            <input
              name="projectId"
              className="input mt-1"
              defaultValue={initial.projectId ?? ""}
              placeholder="procore-project-123"
            />
          </label>
          <label className="text-sm text-gray-700">
            Outbound Auth Token
            <input
              name="authToken"
              className="input mt-1"
              placeholder="Bearer token for Procore endpoint"
            />
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            Inbound Shared Secret
            <input
              name="inboundSharedSecret"
              className="input mt-1"
              placeholder="Bearer token accepted by /api/integrations/procore/workers"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input name="enabled" type="checkbox" defaultChecked={initial.enabled} />
            Enabled
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              name="includeSignInEvents"
              type="checkbox"
              defaultChecked={initial.includeSignInEvents}
            />
            Include sign-in snapshots
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              name="includePermitEvents"
              type="checkbox"
              defaultChecked={initial.includePermitEvents}
            />
            Include permit snapshots
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Save Connector
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Queue Outbound Sync
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {sites.map((site) => (
            <form
              key={site.id}
              action={async () => {
                "use server";
                await queueProcoreSyncAction(site.id);
              }}
            >
              <button
                type="submit"
                className="rounded border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                Queue {site.name}
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Sync Activity
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Timestamp
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Event
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {connectorEvents.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-sm text-gray-500">
                    No connector events yet.
                  </td>
                </tr>
              ) : (
                connectorEvents.map((event) => (
                  <tr key={event.id}>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {event.created_at.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{event.event_type}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{event.status ?? "-"}</td>
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
