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
import { PageWarningState } from "@/components/ui/page-state";
import {
  registerDeviceSubscriptionAction,
  revokeDeviceSubscriptionAction,
  resolvePresenceHintAction,
  runAutoCheckoutAssistAction,
} from "./actions";

export const metadata = {
  title: "Mobile Operations | InductLite",
};

function presenceHintStatusChipClass(status: string): string {
  if (status === "OPEN") {
    return "border-amber-400/45 bg-amber-500/15 text-amber-900 dark:text-amber-100";
  }
  if (status === "ACCEPTED") {
    return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
  }
  return "border-[color:var(--border-soft)] bg-[color:var(--bg-surface)]0/12 text-secondary";
}

export default async function MobileOperationsPage() {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  if (!isFeatureEnabled("PWA_PUSH_V1")) {
    return (
      <div className="space-y-6 p-3 sm:p-4">
        <div className="surface-panel-strong p-5">
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Mobile Operations
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Manage PWA push subscriptions and auto check-out assistance hints.
          </p>
        </div>
        <PageWarningState
          title="Mobile push/assist workflows are disabled by rollout flag."
          description="CONTROL_ID: FLAG-ROLLOUT-001."
        />
      </div>
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "PWA_PUSH_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="space-y-6 p-3 sm:p-4">
          <div className="surface-panel-strong p-5">
            <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
              Mobile Operations
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Manage PWA push subscriptions and auto check-out assistance hints.
            </p>
          </div>
          <PageWarningState
            title="Mobile push/assist workflows are not enabled for this plan."
            description="CONTROL_ID: PLAN-ENTITLEMENT-001."
          />
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
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Mobile & Presence Operations
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Manage PWA push subscriptions and auto check-out assistance hints.
          </p>
        </div>
        <Link href="/admin/mobile/native" className="btn-secondary min-h-[36px] px-3 py-1.5 text-xs">
          Native iOS/Android Runtime
        </Link>
      </div>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Auto Check-Out Assist
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await runAutoCheckoutAssistAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-3"
        >
          <label className="text-sm text-secondary">
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
          <label className="text-sm text-secondary">
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
              className="btn-primary"
            >
              Run Assist
            </button>
          </div>
        </form>

        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
            Open Hints
          </h3>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
              <thead className="bg-[color:var(--bg-surface-strong)]">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Site
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Hint Type
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Suggested
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
                {openHints.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-sm text-muted">
                      No open hints.
                    </td>
                  </tr>
                ) : (
                  openHints.map((hint) => (
                    <tr key={hint.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                      <td className="px-3 py-3 text-sm text-secondary">
                        {sites.find((site) => site.id === hint.site_id)?.name ?? "Site"}
                      </td>
                      <td className="px-3 py-3 text-sm text-secondary">{hint.hint_type}</td>
                      <td className="px-3 py-3 text-sm text-secondary">
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
                              className="rounded-lg border border-emerald-400/40 bg-emerald-500/12 px-2 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-500/20 dark:text-emerald-100"
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
                              className="btn-secondary min-h-[30px] px-2 py-1 text-xs"
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

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Register Device Subscription (Admin Test)
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await registerDeviceSubscriptionAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-2"
        >
          <label className="text-sm text-secondary">
            Endpoint URL
            <input name="endpoint" className="input mt-1" type="url" required />
          </label>
          <label className="text-sm text-secondary">
            Public Key (p256dh)
            <input name="publicKey" className="input mt-1" required />
          </label>
          <label className="text-sm text-secondary">
            Auth Key
            <input name="authKey" className="input mt-1" required />
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
          <label className="text-sm text-secondary md:col-span-2">
            Platform
            <input
              name="platform"
              className="input mt-1"
              placeholder="ios-native / android-native / ios-pwa / android-pwa"
              defaultValue="ios-native"
            />
          </label>
          <label className="text-sm text-secondary">
            App Version (optional)
            <input name="appVersion" className="input mt-1" placeholder="1.0.0" />
          </label>
          <label className="text-sm text-secondary">
            OS Version (optional)
            <input name="osVersion" className="input mt-1" placeholder="iOS 17 / Android 15" />
          </label>
          <label className="text-sm text-secondary md:col-span-2">
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
              className="btn-primary"
            >
              Save Subscription
            </button>
          </div>
        </form>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Secure Enrollment
        </h2>
        <p className="mt-3 text-sm text-secondary">
          Generate device enrollment credentials using:
          <code className="ml-1 rounded bg-[color:var(--bg-surface-strong)] px-1 py-0.5 text-xs text-[color:var(--text-primary)]">POST /api/mobile/enrollment-token</code>
          .
          Enrolled devices submit background entry/exit events to:
          <code className="ml-1 rounded bg-[color:var(--bg-surface-strong)] px-1 py-0.5 text-xs text-[color:var(--text-primary)]">POST /api/mobile/geofence-events</code>
          . Batched replay is available at:
          <code className="ml-1 rounded bg-[color:var(--bg-surface-strong)] px-1 py-0.5 text-xs text-[color:var(--text-primary)]">POST /api/mobile/geofence-events/replay</code>
          . Heartbeats are available at:
          <code className="ml-1 rounded bg-[color:var(--bg-surface-strong)] px-1 py-0.5 text-xs text-[color:var(--text-primary)]">POST /api/mobile/heartbeat</code>
          .
        </p>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Device Subscriptions
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Runtime
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Site
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Endpoint
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Health
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-sm text-muted">
                    No active subscriptions.
                  </td>
                </tr>
              ) : (
                subscriptions.map((subscription) => (
                  <tr key={subscription.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                    <td className="px-3 py-3 text-xs text-secondary">
                      {(() => {
                        const runtime = parseDeviceRuntime(subscription.platform);
                        return (
                          <div className="space-y-0.5">
                            <div className="font-semibold">{runtime.platform}</div>
                            <div className="text-muted">
                              {runtime.appVersion ? `app ${runtime.appVersion}` : "app -"}
                              {" | "}
                              {runtime.osVersion ? runtime.osVersion : "os -"}
                            </div>
                            <div className="text-muted">
                              {runtime.wrapperChannel
                                ? `channel ${runtime.wrapperChannel}`
                                : "channel -"}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">
                      {sites.find((site) => site.id === subscription.site_id)?.name ?? "All sites"}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">
                      <span className="inline-block max-w-[32rem] truncate">
                        {subscription.endpoint}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-secondary">
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
                              <div className="text-muted">
                                last seen {seenAt.toLocaleString("en-NZ")}
                              </div>
                            </div>
                          );
                        }
                        if (minutesAgo <= 180) {
                          return (
                            <div>
                              <div className="font-semibold text-amber-700">Degraded</div>
                              <div className="text-muted">
                                last seen {seenAt.toLocaleString("en-NZ")}
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div>
                            <div className="font-semibold text-red-700">Stale</div>
                            <div className="text-muted">
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
                          className="btn-danger min-h-[30px] px-2 py-1 text-xs"
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

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Hint History
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Suggested
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Type
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Resolved
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {allHints.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-sm text-muted">
                    No hints in history.
                  </td>
                </tr>
              ) : (
                allHints.map((hint) => (
                  <tr key={hint.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                    <td className="px-3 py-3 text-sm text-secondary">
                      {hint.suggested_at.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">{hint.hint_type}</td>
                    <td className="px-3 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${presenceHintStatusChipClass(hint.status)}`}
                      >
                        {hint.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">
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
