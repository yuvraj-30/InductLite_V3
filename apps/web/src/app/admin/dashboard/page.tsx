/**
 * Admin Dashboard Page
 *
 * Displays KPIs for the current tenant:
 * - Active sites count
 * - Currently on-site contractors
 * - Sign-ins today and last 7 days
 * - Documents expiring soon
 */

import Link from "next/link";
import { checkAuthReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import { redirect } from "next/navigation";
import {
  getDashboardMetrics,
  getOnboardingProgress,
} from "@/lib/repository/dashboard.repository";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import { OnboardingChecklist } from "../components/OnboardingChecklist";

export const metadata = {
  title: "Dashboard | InductLite",
};

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ welcome?: string }>;
}) {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/dashboard",
    method: "GET",
  });

  // Check authentication only. Audit-specific sections remain role-gated below.
  const result = await checkAuthReadOnly();
  if (!result.success) {
    if (result.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/login");
  }
  const canManageContractors =
    result.user.role === "ADMIN" || result.user.role === "SITE_MANAGER";
  const canManageUsers = result.user.role === "ADMIN";
  const canManageSites = canManageContractors;
  const canManageTemplates = canManageContractors;

  const context = await requireAuthenticatedContextReadOnly();
  const companyId = context.companyId;
  const params = await searchParams;
  const showWelcome = params?.welcome === "1";

  let metricsLoadFailed = false;
  const metricsFallback: Awaited<ReturnType<typeof getDashboardMetrics>> = {
    activeSitesCount: 0,
    totalSitesCount: 0,
    currentlyOnSiteCount: 0,
    signInsToday: 0,
    signInsSevenDays: 0,
    documentsExpiringSoon: 0,
    recentSignIns: [],
    recentAuditLogs: [],
  };
  const onboardingFallback: Awaited<ReturnType<typeof getOnboardingProgress>> = {
    totalSitesCount: 0,
    publishedTemplatesCount: 0,
    totalSignInsCount: 0,
    hasSites: false,
    hasPublishedTemplate: false,
    hasFirstSignIn: false,
    onboardingComplete: false,
  };

  const [metrics, onboardingProgress] = await Promise.all([
    getDashboardMetrics(companyId).catch((error) => {
      metricsLoadFailed = true;
      log.error(
        { company_id: companyId, error: String(error) },
        "Dashboard metrics load failed",
      );
      return metricsFallback;
    }),
    getOnboardingProgress(companyId).catch((error) => {
      log.error(
        { company_id: companyId, error: String(error) },
        "Dashboard onboarding state load failed",
      );
      return onboardingFallback;
    }),
  ]);

  const {
    activeSitesCount,
    totalSitesCount,
    currentlyOnSiteCount,
    signInsToday,
    signInsSevenDays,
    documentsExpiringSoon,
    recentSignIns,
    recentAuditLogs,
  } = metrics;

  const totalVisitorsWindow = Math.max(signInsSevenDays, 1);
  const liveOccupancyPercent = Math.min(
    100,
    Math.round((currentlyOnSiteCount / totalVisitorsWindow) * 100),
  );

  return (
    <div className="space-y-6 p-2 sm:p-3">
      <section className="surface-panel-strong kinetic-hover overflow-hidden bg-gradient-to-br from-indigo-500/18 via-cyan-400/12 to-transparent p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
          Mission Control
        </p>
        <h1 className="kinetic-title mt-1 text-3xl font-black sm:text-4xl">Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-secondary sm:text-base">
          Real-time operations overview across sites, workforce presence, and compliance risk.
        </p>
      </section>

      {metricsLoadFailed && (
        <div className="rounded-xl border border-amber-400/45 bg-amber-100/70 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/45 dark:text-amber-100">
          Dashboard data could not be loaded. Please refresh and try again.
        </div>
      )}

      {(showWelcome || !onboardingProgress.onboardingComplete) && (
        <OnboardingChecklist
          progress={onboardingProgress}
          className="mb-8"
          title="Get Started Checklist"
          canManageSites={canManageSites}
          canManageTemplates={canManageTemplates}
          showWhenComplete={showWelcome}
        />
      )}

      <section className="bento-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <Link href="/admin/sites" className="kinetic-hover bento-card xl:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                Active Sites
              </p>
              <p className="mt-2 text-4xl font-black text-[color:var(--text-primary)]">
                {activeSitesCount}
                <span className="ml-2 text-base font-medium text-muted">
                  / {totalSitesCount}
                </span>
              </p>
              <p className="mt-2 text-sm text-secondary">
                Live sites currently accepting sign-ins.
              </p>
            </div>
            <div className="rounded-2xl border border-indigo-400/30 bg-indigo-500/14 p-3">
              <svg
                className="h-6 w-6 text-indigo-800 dark:text-indigo-100"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
          </div>
        </Link>

        <div className="bento-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                On Site Right Now
              </p>
              <p className="mt-2 text-4xl font-black text-[color:var(--accent-success)]">
                {currentlyOnSiteCount}
              </p>
              <p className="mt-1 text-xs text-muted">
                Approx. {liveOccupancyPercent}% of this week&apos;s sign-in volume.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/16 p-3">
              <svg
                className="h-6 w-6 text-emerald-800 dark:text-emerald-100"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bento-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                Sign-In Velocity
              </p>
              <p className="mt-2 text-4xl font-black text-[color:var(--text-primary)]">
                {signInsToday}
              </p>
              <p className="mt-1 text-sm text-secondary">
                {signInsSevenDays} sign-ins in the last 7 days.
              </p>
            </div>
            <div className="rounded-2xl border border-fuchsia-400/35 bg-fuchsia-500/14 p-3">
              <svg
                className="h-6 w-6 text-fuchsia-900 dark:text-fuchsia-100"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bento-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                Documents Expiring
              </p>
              <p
                className={`mt-2 text-4xl font-black ${documentsExpiringSoon > 0 ? "text-amber-800 dark:text-amber-100" : "text-[color:var(--text-primary)]"}`}
              >
                {documentsExpiringSoon}
              </p>
              <p className="mt-1 text-sm text-secondary">Due within the next 30 days.</p>
            </div>
            <div
              className={`rounded-2xl border p-3 ${documentsExpiringSoon > 0 ? "border-amber-400/45 bg-amber-500/18" : "border-white/35 bg-white/45"}`}
            >
              <div
                className={`${documentsExpiringSoon > 0 ? "text-amber-900 dark:text-amber-100" : "text-secondary"}`}
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {(canManageContractors || canManageUsers) && (
        <section>
          <h2 className="kinetic-title mb-3 text-lg font-black text-[color:var(--text-primary)]">
            Management
          </h2>
          <div className="bento-grid grid-cols-1 md:grid-cols-2">
            {canManageContractors && (
              <Link
                href="/admin/contractors"
                className="kinetic-hover bento-card"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                  Contractors
                </p>
                <p className="kinetic-title mt-1 text-xl font-bold text-[color:var(--text-primary)]">
                  View and manage contractor records
                </p>
                <p className="mt-2 text-sm text-secondary">
                  Update status, details, and compliance readiness.
                </p>
              </Link>
            )}
            {canManageUsers && (
              <Link
                href="/admin/users"
                className="kinetic-hover bento-card"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                  Users
                </p>
                <p className="kinetic-title mt-1 text-xl font-bold text-[color:var(--text-primary)]">
                  View roles and account status
                </p>
                <p className="mt-2 text-sm text-secondary">
                  Manage role permissions and account lifecycle.
                </p>
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="bento-grid grid-cols-1 lg:grid-cols-2">
        <div className="surface-panel overflow-hidden">
          <div className="border-b border-white/25 px-5 py-4">
            <h2 className="kinetic-title text-xl font-black text-[color:var(--text-primary)]">
              Recent Sign-Ins
            </h2>
          </div>
          <div className="p-5">
            {recentSignIns.length === 0 ? (
              <p className="text-sm text-secondary">No recent sign-ins.</p>
            ) : (
              <ul className="divide-y divide-white/20">
                {recentSignIns.map((record) => (
                  <li key={record.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                          {record.visitor_name}
                        </p>
                        <p className="text-sm text-secondary">
                          {record.site.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted">
                          {new Date(record.sign_in_ts).toLocaleString()}
                        </p>
                        {!record.sign_out_ts && (
                          <span className="mt-1 inline-flex items-center rounded-full border border-emerald-400/35 bg-emerald-500/16 px-2 py-0.5 text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                            On site
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="surface-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/25 px-5 py-4">
            <h2 className="kinetic-title text-xl font-black text-[color:var(--text-primary)]">
              Recent Activity
            </h2>
            <Link
              href="/admin/audit-log"
              className="rounded-lg border border-white/35 bg-white/45 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-secondary hover:bg-white/70"
            >
              View all
            </Link>
          </div>
          <div className="p-5">
            {recentAuditLogs.length === 0 ? (
              <p className="text-sm text-secondary">No recent activity.</p>
            ) : (
              <ul className="divide-y divide-white/20">
                {recentAuditLogs.map((log) => (
                  <li key={log.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                          {formatAuditAction(log.action)}
                        </p>
                        <p className="text-sm text-secondary">
                          by {log.user?.name || "System"}
                        </p>
                      </div>
                      <p className="text-xs text-muted">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Format audit action for display
 */
function formatAuditAction(action: string): string {
  const actionMap: Record<string, string> = {
    "user.login": "User logged in",
    "user.logout": "User logged out",
    "user.password_change": "Password changed",
    "site.create": "Site created",
    "site.update": "Site updated",
    "site.deactivate": "Site deactivated",
    "site.reactivate": "Site reactivated",
    "publiclink.create": "QR link rotated",
    "contractor.create": "Contractor registered",
    "contractor.delete": "Contractor deleted",
    "signin.create": "Contractor signed in",
    "signin.signout": "Contractor signed out",
    "user.delete": "User deleted",
  };

  return actionMap[action] || action.replace(".", " ").replace(/_/g, " ");
}

