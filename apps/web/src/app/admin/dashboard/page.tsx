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
    documentExpiryWindows: {
      overdue: 0,
      dueIn1Day: 0,
      dueIn7Days: 0,
      dueIn14Days: 0,
      dueIn30Days: 0,
    },
    locationAuditSummary: {
      totalSignIns30Days: 0,
      captured: 0,
      withinRadius: 0,
      outsideRadius: 0,
      withoutCapture: 0,
    },
    rollCallSummary: {
      activeEvents: 0,
      activeSites: 0,
      trackedPeople: 0,
      missingPeople: 0,
      closedEventsLast7Days: 0,
    },
    drillSummary: {
      drillsLast30Days: 0,
      overdueDrills: 0,
      dueIn7Days: 0,
    },
    quizSummary: {
      scoredResponses30Days: 0,
      passedResponses30Days: 0,
      failedResponses30Days: 0,
      passRatePercent: 0,
      activeCooldowns: 0,
      profilesAttempted30Days: 0,
      profilesWithRecentFailures: 0,
      topRiskTemplateSites: [],
    },
    hostArrivalNotifications: [],
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
    getDashboardMetrics(companyId, {
      userId: result.user.id,
      userRole: result.user.role,
    }).catch((error) => {
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
    documentExpiryWindows,
    locationAuditSummary,
    rollCallSummary,
    drillSummary,
    quizSummary,
    hostArrivalNotifications,
    recentSignIns,
    recentAuditLogs,
  } = metrics;

  const totalVisitorsWindow = Math.max(signInsSevenDays, 1);
  const liveOccupancyPercent = Math.min(
    100,
    Math.round((currentlyOnSiteCount / totalVisitorsWindow) * 100),
  );
  const locationCaptureRate =
    locationAuditSummary.totalSignIns30Days > 0
      ? Math.round(
          (locationAuditSummary.captured /
            locationAuditSummary.totalSignIns30Days) *
            100,
        )
      : 0;

  return (
    <div className="space-y-6 p-2 sm:p-3">
      <section className="surface-panel-strong overflow-hidden p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
          Overview
        </p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-secondary sm:text-base">
          Live overview of sites, on-site workforce, and compliance risk.
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
                Around {liveOccupancyPercent}% of this week&apos;s sign-ins are on site now.
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
              <div className="mt-2 text-xs text-secondary">
                <p>1 day: {documentExpiryWindows.dueIn1Day}</p>
                <p>7 days: {documentExpiryWindows.dueIn7Days}</p>
                <p>14 days: {documentExpiryWindows.dueIn14Days}</p>
                <p>Overdue: {documentExpiryWindows.overdue}</p>
              </div>
            </div>
            <div
              className={`rounded-2xl border p-3 ${documentsExpiringSoon > 0 ? "border-amber-400/45 bg-amber-500/18" : "border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)]"}`}
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

      <section className="bento-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/admin/live-register"
          className="kinetic-hover bento-card border-amber-300/40 bg-amber-500/10"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                Roll-Call Command
              </p>
              <p className="mt-2 text-3xl font-black text-amber-900 dark:text-amber-100">
                {rollCallSummary.activeEvents}
              </p>
              <p className="mt-1 text-sm text-secondary">
                Active events across {rollCallSummary.activeSites} site
                {rollCallSummary.activeSites === 1 ? "" : "s"}.
              </p>
              <p className="mt-1 text-xs text-secondary">
                Tracked: {rollCallSummary.trackedPeople} | Missing:{" "}
                {rollCallSummary.missingPeople} | Closed (7d):{" "}
                {rollCallSummary.closedEventsLast7Days}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-400/45 bg-amber-500/18 p-3">
              <svg
                className="h-6 w-6 text-amber-900 dark:text-amber-100"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-7.938 4h15.876c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L2.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/sites"
          className="kinetic-hover bento-card border-cyan-300/40 bg-cyan-500/10"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                Drill Readiness
              </p>
              <p className="mt-2 text-3xl font-black text-cyan-900 dark:text-cyan-100">
                {drillSummary.drillsLast30Days}
              </p>
              <p className="mt-1 text-sm text-secondary">
                Emergency drills recorded in the last 30 days.
              </p>
              <p className="mt-1 text-xs text-secondary">
                Due in 7d: {drillSummary.dueIn7Days} | Overdue:{" "}
                {drillSummary.overdueDrills}
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-400/40 bg-cyan-500/16 p-3">
              <svg
                className="h-6 w-6 text-cyan-900 dark:text-cyan-100"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/history"
          className="kinetic-hover bento-card border-indigo-300/40 bg-indigo-500/10"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                Location Verification
              </p>
              <p className="mt-2 text-3xl font-black text-indigo-900 dark:text-indigo-100">
                {locationCaptureRate}%
              </p>
              <p className="mt-1 text-sm text-secondary">
                Capture rate in the last 30 days ({locationAuditSummary.captured}/
                {locationAuditSummary.totalSignIns30Days}).
              </p>
              <p className="mt-1 text-xs text-secondary">
                Within: {locationAuditSummary.withinRadius} | Outside:{" "}
                {locationAuditSummary.outsideRadius} | Missing:{" "}
                {locationAuditSummary.withoutCapture}
              </p>
            </div>
            <div className="rounded-2xl border border-indigo-400/40 bg-indigo-500/16 p-3">
              <svg
                className="h-6 w-6 text-indigo-900 dark:text-indigo-100"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"
                />
              </svg>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/templates"
          className="kinetic-hover bento-card border-violet-300/40 bg-violet-500/10"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                Quiz Compliance
              </p>
              <p className="mt-2 text-3xl font-black text-violet-900 dark:text-violet-100">
                {quizSummary.passRatePercent}%
              </p>
              <p className="mt-1 text-sm text-secondary">
                Pass rate for quiz-scored inductions in the last 30 days.
              </p>
              <p className="mt-1 text-xs text-secondary">
                Passed: {quizSummary.passedResponses30Days} | Failed:{" "}
                {quizSummary.failedResponses30Days}
              </p>
              <p className="mt-1 text-xs text-secondary">
                Cooldowns: {quizSummary.activeCooldowns} | Risk profiles:{" "}
                {quizSummary.profilesWithRecentFailures}
              </p>
            </div>
            <div className="rounded-2xl border border-violet-400/40 bg-violet-500/16 p-3">
              <svg
                className="h-6 w-6 text-violet-900 dark:text-violet-100"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17v-2a4 4 0 014-4h4m0 0l-3-3m3 3l-3 3M5 3h12a2 2 0 012 2v5M7 21H5a2 2 0 01-2-2V9a2 2 0 012-2h2"
                />
              </svg>
            </div>
          </div>
        </Link>
      </section>

      <section className="surface-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-surface-soft px-5 py-4">
          <div>
            <h2 className="kinetic-title text-xl font-black text-[color:var(--text-primary)]">
              Quiz Performance Signals (30 Days)
            </h2>
            <p className="mt-1 text-sm text-secondary">
              Monitors pass/fail outcomes and cooldown pressure from current quiz
              attempt profiles.
            </p>
          </div>
          <Link
            href="/admin/templates"
            className="inline-flex min-h-[38px] items-center rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-3 py-2 text-xs font-semibold text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface)]"
          >
            Manage Templates
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-4">
          <div className="rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
              Scored Responses
            </p>
            <p className="mt-2 text-3xl font-black text-[color:var(--text-primary)]">
              {quizSummary.scoredResponses30Days}
            </p>
          </div>
          <div className="rounded-lg border border-emerald-400/35 bg-emerald-500/14 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-900 dark:text-emerald-100">
              Passed
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-900 dark:text-emerald-100">
              {quizSummary.passedResponses30Days}
            </p>
          </div>
          <div className="rounded-lg border border-rose-400/35 bg-rose-500/14 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-900 dark:text-rose-100">
              Failed
            </p>
            <p className="mt-2 text-3xl font-black text-rose-900 dark:text-rose-100">
              {quizSummary.failedResponses30Days}
            </p>
          </div>
          <div className="rounded-lg border border-amber-400/35 bg-amber-500/16 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-900 dark:text-amber-100">
              Active Cooldowns
            </p>
            <p className="mt-2 text-3xl font-black text-amber-900 dark:text-amber-100">
              {quizSummary.activeCooldowns}
            </p>
            <p className="mt-1 text-xs text-secondary">
              {quizSummary.profilesAttempted30Days} recent attempt profile
              {quizSummary.profilesAttempted30Days === 1 ? "" : "s"} tracked.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto px-5 pb-5">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)] rounded-xl border border-surface-soft">
            <thead className="bg-[color:var(--bg-surface)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Template
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Site
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Attempt Profiles
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Fail Profiles
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Active Cooldowns
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {quizSummary.topRiskTemplateSites.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-secondary">
                    No recent quiz attempt pressure detected.
                  </td>
                </tr>
              ) : (
                quizSummary.topRiskTemplateSites.map((row) => (
                  <tr key={`${row.template_id}:${row.site_id}`}>
                    <td className="px-4 py-3 text-sm font-medium text-[color:var(--text-primary)]">
                      {row.template_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary">{row.site_name}</td>
                    <td className="px-4 py-3 text-right text-sm text-[color:var(--text-primary)]">
                      {row.recent_attempt_profiles}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-rose-900 dark:text-rose-100">
                      {row.recent_fail_profiles}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-amber-900 dark:text-amber-100">
                      {row.active_cooldowns}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
                  Keep details current and compliance-ready.
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
                  Manage access, roles, and account state.
                </p>
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="bento-grid grid-cols-1 lg:grid-cols-3">
        <div className="surface-panel overflow-hidden">
          <div className="border-b border-surface-soft px-5 py-4">
            <h2 className="kinetic-title text-xl font-black text-[color:var(--text-primary)]">
              Recent Sign-Ins
            </h2>
          </div>
          <div className="p-5">
            {recentSignIns.length === 0 ? (
              <p className="text-sm text-secondary">No recent sign-ins.</p>
            ) : (
              <ul className="divide-y divide-[color:var(--border-soft)]">
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
          <div className="flex items-center justify-between border-b border-surface-soft px-5 py-4">
            <h2 className="kinetic-title text-xl font-black text-[color:var(--text-primary)]">
              Recent Activity
            </h2>
            <Link
              href="/admin/audit-log"
              className="rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-secondary hover:bg-[color:var(--bg-surface-strong)]"
            >
              View all
            </Link>
          </div>
          <div className="p-5">
            {recentAuditLogs.length === 0 ? (
              <p className="text-sm text-secondary">No recent activity.</p>
            ) : (
              <ul className="divide-y divide-[color:var(--border-soft)]">
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

        <div className="surface-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-surface-soft px-5 py-4">
            <h2 className="kinetic-title text-xl font-black text-[color:var(--text-primary)]">
              Arrival Alerts
            </h2>
            <span className="rounded-lg border border-cyan-400/35 bg-cyan-500/16 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-900 dark:text-cyan-100">
              In-app
            </span>
          </div>
          <div className="p-5">
            {hostArrivalNotifications.length === 0 ? (
              <p className="text-sm text-secondary">No host arrival alerts yet.</p>
            ) : (
              <ul className="divide-y divide-[color:var(--border-soft)]">
                {hostArrivalNotifications.map((notification) => (
                  <li key={notification.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                          {notification.visitor_name}
                        </p>
                        <p className="text-sm text-secondary">{notification.site_name}</p>
                        <p className="mt-1 text-xs text-muted">
                          {notification.targeted
                            ? "Targeted to you"
                            : "Broadcast to site managers"}
                        </p>
                      </div>
                      <p className="text-xs text-muted">
                        {new Date(notification.created_at).toLocaleString()}
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


