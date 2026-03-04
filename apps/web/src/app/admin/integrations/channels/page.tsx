import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { findAllSites } from "@/lib/repository/site.repository";
import {
  listChannelDeliveries,
  listChannelIntegrationConfigs,
} from "@/lib/repository/communication.repository";
import {
  deactivateChannelIntegrationAction,
  sendChannelIntegrationTestAction,
  upsertChannelIntegrationAction,
} from "./actions";

export const metadata = {
  title: "Channel Integrations | InductLite",
};

export default async function ChannelIntegrationsPage() {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();

  if (!isFeatureEnabled("TEAMS_SLACK_V1")) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Channel Integrations</h1>
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Teams/Slack integrations are disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001).
        </p>
      </div>
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "TEAMS_SLACK_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">Channel Integrations</h1>
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Teams/Slack integrations are not enabled for this plan (CONTROL_ID:
            PLAN-ENTITLEMENT-001).
          </p>
        </div>
      );
    }
    throw error;
  }

  const [sites, configs, deliveries] = await Promise.all([
    findAllSites(context.companyId),
    listChannelIntegrationConfigs(context.companyId),
    listChannelDeliveries(context.companyId, { limit: 200 }),
  ]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Teams/Slack Integrations</h1>
        <p className="mt-1 text-sm text-gray-600">
          Configure channel endpoints for notifications and approval action loops.
        </p>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Add / Update Integration
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await upsertChannelIntegrationAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-3"
        >
          <label className="text-sm text-gray-700">
            Existing Integration ID (optional)
            <input name="integrationId" className="input mt-1" placeholder="Leave blank to create" />
          </label>
          <label className="text-sm text-gray-700">
            Provider
            <select name="provider" className="input mt-1" defaultValue="SLACK">
              <option value="SLACK">SLACK</option>
              <option value="TEAMS">TEAMS</option>
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Site Scope (optional)
            <select name="siteId" className="input mt-1">
              <option value="">All sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label className="md:col-span-3 text-sm text-gray-700">
            Endpoint URL
            <input
              name="endpointUrl"
              className="input mt-1"
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              required
            />
          </label>
          <label className="text-sm text-gray-700">
            Auth Token (optional)
            <input name="authToken" className="input mt-1" />
          </label>
          <label className="text-sm text-gray-700">
            Signing Secret (optional)
            <input name="signingSecret" className="input mt-1" />
          </label>
          <label className="md:col-span-3 text-sm text-gray-700">
            Mappings JSON (optional)
            <input
              name="mappingsJson"
              className="input mt-1"
              placeholder='{"events":{"approval":"#safety-approvals"}}'
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input name="isActive" type="checkbox" defaultChecked className="h-4 w-4" />
            Active
          </label>
          <div className="md:col-span-3">
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Save Integration
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Configured Integrations
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Provider
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Site
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Endpoint
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Status
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {configs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-sm text-gray-500">
                    No channel integrations configured.
                  </td>
                </tr>
              ) : (
                configs.map((config) => (
                  <tr key={config.id}>
                    <td className="px-3 py-3 text-sm text-gray-700">{config.provider}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {sites.find((site) => site.id === config.site_id)?.name ?? "All sites"}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{config.endpoint_url}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {config.is_active ? "ACTIVE" : "INACTIVE"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <form
                          action={async () => {
                            "use server";
                            await sendChannelIntegrationTestAction(config.id);
                          }}
                        >
                          <button
                            type="submit"
                            className="rounded border border-indigo-300 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                          >
                            Test
                          </button>
                        </form>
                        {config.is_active && (
                          <form
                            action={async () => {
                              "use server";
                              await deactivateChannelIntegrationAction(config.id);
                            }}
                          >
                            <button
                              type="submit"
                              className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Deactivate
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Delivery Diagnostics
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
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Retries
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Response
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-sm text-gray-500">
                    No delivery events yet.
                  </td>
                </tr>
              ) : (
                deliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {delivery.created_at.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{delivery.event_type}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{delivery.status}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{delivery.retries}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {delivery.response_status_code ?? "-"}
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
