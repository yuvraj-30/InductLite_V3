import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAuthReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { getAdvancedAuditAnalytics } from "@/lib/repository";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { PageWarningState } from "@/components/ui/page-state";

export const metadata = {
  title: "Advanced Audit Analytics | InductLite",
};

export default async function AdminAuditAnalyticsPage() {
  const auth = await checkAuthReadOnly();
  if (!auth.success) {
    if (auth.code === "UNAUTHENTICATED") {
      redirect("/login");
    }
    redirect("/unauthorized");
  }

  if (auth.user.role !== "ADMIN" && auth.user.role !== "SITE_MANAGER") {
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    await assertCompanyFeatureEnabled(context.companyId, "ANALYTICS_ADVANCED");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="space-y-6 p-3 sm:p-4">
          <div className="surface-panel-strong p-5">
            <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
              Advanced Audit Analytics
            </h1>
            <p className="mt-1 text-sm text-secondary">
              This page is available on the Pro tier with advanced analytics enabled.
            </p>
          </div>
          <PageWarningState
            title="Feature not enabled for this plan."
            description="Upgrade or enable the analytics add-on to access advanced audit dashboards. CONTROL_ID: PLAN-ENTITLEMENT-001."
          />
        </div>
      );
    }
    throw error;
  }

  const analytics = await getAdvancedAuditAnalytics(context.companyId, {
    windowDays: 30,
    timezone: "Pacific/Auckland",
  });

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Advanced Audit Analytics
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Deep security and compliance telemetry for the last 30 days.
          </p>
        </div>
        <Link href="/admin/audit-log" className="btn-secondary">
          View Audit Log
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Total Events"
          value={analytics.totalEvents30Days}
          tone="text-[color:var(--text-primary)]"
        />
        <MetricCard
          label="After Hours Events"
          value={analytics.afterHoursEventCount30Days}
          tone="text-amber-900 dark:text-amber-100"
        />
        <MetricCard
          label="Failed Logins"
          value={analytics.failedLoginCount30Days}
          tone="text-red-900 dark:text-red-100"
        />
        <MetricCard
          label="Escalation Events"
          value={analytics.escalationEventCount30Days}
          tone="text-indigo-900 dark:text-indigo-100"
        />
        <MetricCard
          label="Hardware Denies"
          value={analytics.hardwareDeniedCount30Days}
          tone="text-orange-900 dark:text-orange-100"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="surface-panel p-4 xl:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
            Daily Event Trend
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
              <thead className="bg-[color:var(--bg-surface-strong)]">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                    Day
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                    Events
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
                {analytics.dailyEventTrend.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-3 py-4 text-center text-sm text-secondary">
                      No audit events found.
                    </td>
                  </tr>
                ) : (
                  analytics.dailyEventTrend.map((row) => (
                    <tr key={row.day} className="hover:bg-[color:var(--bg-surface-strong)]">
                      <td className="px-3 py-2 text-sm text-secondary">{row.day}</td>
                      <td className="px-3 py-2 text-right text-sm font-semibold text-[color:var(--text-primary)]">
                        {row.count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="surface-panel p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
            Top IP Addresses
          </h2>
          <ul className="mt-3 space-y-2">
            {analytics.topIpAddresses.length === 0 ? (
              <li className="text-sm text-secondary">No IP data recorded.</li>
            ) : (
              analytics.topIpAddresses.map((row) => (
                <li
                  key={row.ipAddress}
                  className="flex items-center justify-between rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-3 py-2 text-sm"
                >
                  <span className="font-mono text-secondary">{row.ipAddress}</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">{row.count}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Top Actions (30 Days)
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                  Action
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                  Count
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                  Share
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {analytics.topActions.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-sm text-secondary">
                    No actions recorded.
                  </td>
                </tr>
              ) : (
                analytics.topActions.map((row) => (
                  <tr key={row.action} className="hover:bg-[color:var(--bg-surface-strong)]">
                    <td className="px-3 py-2 text-sm text-secondary">{row.action}</td>
                    <td className="px-3 py-2 text-right text-sm font-semibold text-[color:var(--text-primary)]">
                      {row.count}
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-secondary">
                      {row.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Unique Actors"
          value={analytics.uniqueActorCount30Days}
          tone="text-[color:var(--text-primary)]"
        />
        <MetricCard
          label="System Events"
          value={analytics.systemEventCount30Days}
          tone="text-secondary"
        />
        <MetricCard
          label="SMS Sent"
          value={analytics.smsSentCount30Days}
          tone="text-emerald-900 dark:text-emerald-100"
        />
        <MetricCard
          label="SMS Failed"
          value={analytics.smsFailedCount30Days}
          tone="text-red-900 dark:text-red-100"
        />
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="surface-panel p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}
