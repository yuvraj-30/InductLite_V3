import { redirect } from "next/navigation";
import Link from "next/link";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { findAllSites } from "@/lib/repository/site.repository";
import {
  listActiveDeviceSubscriptions,
  listPresenceHints,
} from "@/lib/repository/mobile-ops.repository";
import { parseDeviceRuntime } from "@/lib/mobile/device-runtime";
import {
  registerDeviceSubscriptionAction,
  revokeDeviceSubscriptionAction,
  resolvePresenceHintAction,
  runAutoCheckoutAssistAction,
} from "./actions";

export const metadata = {
  title: "Mobile Operations | InductLite",
};

export default async function MobileOperationsPage() {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  if (!isFeatureEnabled("PWA_PUSH_V1")) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Mobile Operations</h1>
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Mobile push/assist workflows are disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001).
        </p>
      </div>
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "PWA_PUSH_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">Mobile Operations</h1>
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Mobile push/assist workflows are not enabled for this plan (CONTROL_ID:
            PLAN-ENTITLEMENT-001).
          </p>
        </div>
      );
    }
    throw error;
  }

  const [sites, subscriptions, openHints, allHints] = await Promise.all([
    findAllSites(context.companyId),
    listActiveDeviceSubscriptions(context.companyId, { limit: 200 }),
    listPresenceHints(context.companyId, { status: "OPEN", limit: 200 }),
    listPresenceHints(context.companyId, { limit: 200 }),
  ]);
  const now = Date.now();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mobile & Presence Operations</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage PWA push subscriptions and auto check-out assistance hints.
        </p>
        <div className="mt-3">
          <Link
            href="/admin/mobile/native"
            className="inline-flex min-h-[36px] items-center rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Native iOS/Android Runtime
          </Link>
        </div>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Auto Check-Out Assist
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await runAutoCheckoutAssistAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-3"
        >
          <label className="text-sm text-gray-700">
            Site scope
            <select name="siteId" className="input mt-1">
              <option value="">All sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Stale threshold (minutes)
            <input
              name="staleMinutes"
              type="number"
              min={30}
              max={2880}
              defaultValue={720}
              className="input mt-1"
            />
          </label>
          <div className="self-end">
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Run Assist
            </button>
          </div>
        </form>

        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
            Open Hints
          </h3>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Site
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Hint Type
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Suggested
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {openHints.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-sm text-gray-500">
                      No open hints.
                    </td>
                  </tr>
                ) : (
                  openHints.map((hint) => (
                    <tr key={hint.id}>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        {sites.find((site) => site.id === hint.site_id)?.name ?? "Site"}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">{hint.hint_type}</td>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        {hint.suggested_at.toLocaleString("en-NZ")}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <form
                            action={async () => {
                              "use server";
                              await resolvePresenceHintAction(hint.id, "ACCEPTED");
                            }}
                          >
                            <button
                              type="submit"
                              className="rounded border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                            >
                              Accept
                            </button>
                          </form>
                          <form
                            action={async () => {
                              "use server";
                              await resolvePresenceHintAction(hint.id, "DISMISSED");
                            }}
                          >
                            <button
                              type="submit"
                              className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Dismiss
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Register Device Subscription (Admin Test)
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await registerDeviceSubscriptionAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-2"
        >
          <label className="text-sm text-gray-700">
            Endpoint URL
            <input name="endpoint" className="input mt-1" type="url" required />
          </label>
          <label className="text-sm text-gray-700">
            Public Key (p256dh)
            <input name="publicKey" className="input mt-1" required />
          </label>
          <label className="text-sm text-gray-700">
            Auth Key
            <input name="authKey" className="input mt-1" required />
          </label>
          <label className="text-sm text-gray-700">
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
          <label className="text-sm text-gray-700 md:col-span-2">
            Platform
            <input
              name="platform"
              className="input mt-1"
              placeholder="ios-native / android-native / ios-pwa / android-pwa"
              defaultValue="ios-native"
            />
          </label>
          <label className="text-sm text-gray-700">
            App Version (optional)
            <input name="appVersion" className="input mt-1" placeholder="1.0.0" />
          </label>
          <label className="text-sm text-gray-700">
            OS Version (optional)
            <input name="osVersion" className="input mt-1" placeholder="iOS 17 / Android 15" />
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            Wrapper Channel (optional)
            <input
              name="wrapperChannel"
              className="input mt-1"
              placeholder="app-store / play-store / testflight / internal"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Save Subscription
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Secure Enrollment
        </h2>
        <p className="mt-3 text-sm text-gray-700">
          Generate device enrollment credentials using:
          <code className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-xs">POST /api/mobile/enrollment-token</code>
          .
          Enrolled devices submit background entry/exit events to:
          <code className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-xs">POST /api/mobile/geofence-events</code>
          . Batched replay is available at:
          <code className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-xs">POST /api/mobile/geofence-events/replay</code>
          . Heartbeats are available at:
          <code className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-xs">POST /api/mobile/heartbeat</code>
          .
        </p>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Device Subscriptions
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Runtime
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Site
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Endpoint
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Health
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-sm text-gray-500">
                    No active subscriptions.
                  </td>
                </tr>
              ) : (
                subscriptions.map((subscription) => (
                  <tr key={subscription.id}>
                    <td className="px-3 py-3 text-xs text-gray-700">
                      {(() => {
                        const runtime = parseDeviceRuntime(subscription.platform);
                        return (
                          <div className="space-y-0.5">
                            <div className="font-semibold">{runtime.platform}</div>
                            <div className="text-gray-500">
                              {runtime.appVersion ? `app ${runtime.appVersion}` : "app -"}
                              {" | "}
                              {runtime.osVersion ? runtime.osVersion : "os -"}
                            </div>
                            <div className="text-gray-500">
                              {runtime.wrapperChannel
                                ? `channel ${runtime.wrapperChannel}`
                                : "channel -"}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {sites.find((site) => site.id === subscription.site_id)?.name ?? "All sites"}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      <span className="inline-block max-w-[32rem] truncate">
                        {subscription.endpoint}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-700">
                      {(() => {
                        const seenAt = subscription.last_seen_at;
                        if (!seenAt) {
                          return <span className="text-amber-700">No heartbeat yet</span>;
                        }
                        const minutesAgo = Math.floor(
                          (now - seenAt.getTime()) / (60 * 1000),
                        );
                        if (minutesAgo <= 30) {
                          return (
                            <div>
                              <div className="font-semibold text-emerald-700">Healthy</div>
                              <div className="text-gray-500">
                                last seen {seenAt.toLocaleString("en-NZ")}
                              </div>
                            </div>
                          );
                        }
                        if (minutesAgo <= 180) {
                          return (
                            <div>
                              <div className="font-semibold text-amber-700">Degraded</div>
                              <div className="text-gray-500">
                                last seen {seenAt.toLocaleString("en-NZ")}
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div>
                            <div className="font-semibold text-red-700">Stale</div>
                            <div className="text-gray-500">
                              last seen {seenAt.toLocaleString("en-NZ")}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <form
                        action={async () => {
                          "use server";
                          await revokeDeviceSubscriptionAction(subscription.endpoint);
                        }}
                      >
                        <button
                          type="submit"
                          className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          Revoke
                        </button>
                      </form>
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
          Hint History
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Suggested
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Type
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Resolved
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {allHints.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-sm text-gray-500">
                    No hints in history.
                  </td>
                </tr>
              ) : (
                allHints.map((hint) => (
                  <tr key={hint.id}>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {hint.suggested_at.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{hint.hint_type}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{hint.status}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {hint.resolved_at ? hint.resolved_at.toLocaleString("en-NZ") : "-"}
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
