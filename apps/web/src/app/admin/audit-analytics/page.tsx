import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAuthReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { getAdvancedAuditAnalytics } from "@/lib/repository";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";

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
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Advanced Audit Analytics
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            This page is available on the Pro tier with advanced analytics
            enabled.
          </p>
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              Feature not enabled (CONTROL_ID: PLAN-ENTITLEMENT-001)
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Upgrade or enable the analytics add-on to access advanced audit
              dashboards.
            </p>
          </div>
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
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Advanced Audit Analytics
          </h1>
          <p className="mt-1 text-gray-600">
            Deep security and compliance telemetry for the last 30 days.
          </p>
        </div>
        <Link
          href="/admin/audit-log"
          className="inline-flex min-h-[40px] items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          View Audit Log
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Total Events"
          value={analytics.totalEvents30Days}
          tone="text-gray-900"
        />
        <MetricCard
          label="After Hours Events"
          value={analytics.afterHoursEventCount30Days}
          tone="text-amber-700"
        />
        <MetricCard
          label="Failed Logins"
          value={analytics.failedLoginCount30Days}
          tone="text-rose-700"
        />
        <MetricCard
          label="Escalation Events"
          value={analytics.escalationEventCount30Days}
          tone="text-indigo-700"
        />
        <MetricCard
          label="Hardware Denies"
          value={analytics.hardwareDeniedCount30Days}
          tone="text-orange-700"
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 xl:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
            Daily Event Trend
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Day
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Events
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {analytics.dailyEventTrend.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-3 py-4 text-center text-sm text-gray-500"
                    >
                      No audit events found.
                    </td>
                  </tr>
                ) : (
                  analytics.dailyEventTrend.map((row) => (
                    <tr key={row.day}>
                      <td className="px-3 py-2 text-sm text-gray-700">{row.day}</td>
                      <td className="px-3 py-2 text-right text-sm font-semibold text-gray-900">
                        {row.count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
            Top IP Addresses
          </h2>
          <ul className="mt-3 space-y-2">
            {analytics.topIpAddresses.length === 0 ? (
              <li className="text-sm text-gray-500">No IP data recorded.</li>
            ) : (
              analytics.topIpAddresses.map((row) => (
                <li
                  key={row.ipAddress}
                  className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-gray-700">{row.ipAddress}</span>
                  <span className="font-semibold text-gray-900">{row.count}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className="mt-6 rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Top Actions (30 Days)
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Action
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Count
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Share
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {analytics.topActions.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 py-4 text-center text-sm text-gray-500"
                  >
                    No actions recorded.
                  </td>
                </tr>
              ) : (
                analytics.topActions.map((row) => (
                  <tr key={row.action}>
                    <td className="px-3 py-2 text-sm text-gray-700">{row.action}</td>
                    <td className="px-3 py-2 text-right text-sm font-semibold text-gray-900">
                      {row.count}
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-gray-700">
                      {row.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Unique Actors"
          value={analytics.uniqueActorCount30Days}
          tone="text-gray-900"
        />
        <MetricCard
          label="System Events"
          value={analytics.systemEventCount30Days}
          tone="text-gray-700"
        />
        <MetricCard
          label="SMS Sent"
          value={analytics.smsSentCount30Days}
          tone="text-emerald-700"
        />
        <MetricCard
          label="SMS Failed"
          value={analytics.smsFailedCount30Days}
          tone="text-red-700"
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
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}
