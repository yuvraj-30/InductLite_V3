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
import { Alert } from "@/components/ui/alert";
import { AdminDisclosureSection } from "@/components/ui/admin-disclosure-section";
import { AdminSectionHeader } from "@/components/ui/admin-section-header";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHeadCell,
  DataTableHeader,
  DataTableRow,
  DataTableScroll,
  DataTableShell,
} from "@/components/ui/data-table";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
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

type DashboardMetricCardDefinition = {
  eyebrow: string;
  value: number | string;
  description: string;
  meta?: string;
  href?: string;
  badgeLabel?: string;
  badgeTone?: StatusBadgeTone;
  valueSuffix?: string;
};

type DashboardActionDefinition = {
  href: string;
  label: string;
  detail: string;
  badgeLabel: string;
  tone: StatusBadgeTone;
};

const METRIC_BADGE_CLASS =
  "whitespace-nowrap px-2 py-0.5 text-[10px] leading-4 tracking-[0.05em] sm:text-[11px]";

function DashboardMetricCard({
  card,
}: {
  card: DashboardMetricCardDefinition;
}) {
  const content = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
        <p className="admin-card-eyebrow">{card.eyebrow}</p>
        {card.badgeLabel ? (
          <StatusBadge
            tone={card.badgeTone ?? "neutral"}
            className={METRIC_BADGE_CLASS}
          >
            {card.badgeLabel}
          </StatusBadge>
        ) : null}
      </div>

      <div className="admin-card-value-row">
        <p className="admin-card-value">{card.value}</p>
        {card.valueSuffix ? (
          <span className="admin-card-value-suffix">{card.valueSuffix}</span>
        ) : null}
      </div>
      <p className="admin-card-support">{card.description}</p>
      {card.meta ? <p className="admin-card-meta">{card.meta}</p> : null}
    </>
  );

  if (card.href) {
    return (
      <Link href={card.href} className="admin-card-link h-full">
        {content}
      </Link>
    );
  }

  return <div className="admin-card h-full">{content}</div>;
}

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
    approvalSummary: {
      pending: 0,
      deniedLast7Days: 0,
      watchlistPending: 0,
      randomCheckPending: 0,
      averagePendingMinutes: 0,
    },
    permitSummary: {
      requested: 0,
      active: 0,
      suspended: 0,
      overdue: 0,
    },
    actionSummary: {
      open: 0,
      overdue: 0,
      blocked: 0,
    },
    inspectionSummary: {
      activeSchedules: 0,
      overdue: 0,
      failedRuns30Days: 0,
    },
    competencySummary: {
      blocked30Days: 0,
      expiring: 0,
      pendingVerification: 0,
    },
    resourceSummary: {
      blocked: 0,
      reviewRequired: 0,
      overdueCompliance: 0,
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
    approvalSummary,
    permitSummary,
    actionSummary,
    inspectionSummary,
    competencySummary,
    resourceSummary,
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
  const liveRiskCount =
    documentsExpiringSoon +
    permitSummary.overdue +
    rollCallSummary.missingPeople +
    actionSummary.overdue +
    resourceSummary.overdueCompliance;
  const controlRoomActions: DashboardActionDefinition[] = [
    {
      href: "/admin/approvals",
      label: "Visitor approvals",
      detail:
        approvalSummary.pending > 0
          ? `${approvalSummary.watchlistPending} watchlist and ${approvalSummary.randomCheckPending} random checks waiting`
          : "No visitors are waiting for manual clearance.",
      badgeLabel: approvalSummary.pending > 0 ? `${approvalSummary.pending} waiting` : "Clear",
      tone: approvalSummary.pending > 0 ? "warning" : "success",
    },
    {
      href: "/admin/actions",
      label: "Action register pressure",
      detail:
        actionSummary.open + actionSummary.blocked > 0
          ? `${actionSummary.open} open, ${actionSummary.overdue} overdue, ${actionSummary.blocked} blocked`
          : "No follow-up actions need attention right now.",
      badgeLabel:
        actionSummary.overdue > 0 || actionSummary.blocked > 0
          ? `${actionSummary.overdue + actionSummary.blocked} critical`
          : actionSummary.open > 0
            ? `${actionSummary.open} open`
            : "Clear",
      tone:
        actionSummary.overdue > 0 || actionSummary.blocked > 0
          ? "danger"
          : actionSummary.open > 0
            ? "warning"
            : "success",
    },
    {
      href: "/admin/inspections",
      label: "Inspection queue",
      detail:
        inspectionSummary.overdue + inspectionSummary.failedRuns30Days > 0
          ? `${inspectionSummary.overdue} overdue schedules, ${inspectionSummary.failedRuns30Days} failed runs in 30 days`
          : "Inspection schedules are current.",
      badgeLabel:
        inspectionSummary.overdue + inspectionSummary.failedRuns30Days > 0
          ? `${inspectionSummary.overdue + inspectionSummary.failedRuns30Days} flagged`
          : "Current",
      tone:
        inspectionSummary.overdue > 0 || inspectionSummary.failedRuns30Days > 0
          ? "warning"
          : "success",
    },
  ];
  const primaryMetrics: DashboardMetricCardDefinition[] = [
    {
      href: "/admin/sites",
      eyebrow: "Active sites",
      value: activeSitesCount,
      valueSuffix: `/ ${totalSitesCount}`,
      description: "Operational sites currently open for sign-ins.",
      meta:
        totalSitesCount > activeSitesCount
          ? `${totalSitesCount - activeSitesCount} site${totalSitesCount - activeSitesCount === 1 ? "" : "s"} paused or awaiting activation.`
          : "Every configured site is live right now.",
      badgeLabel:
        totalSitesCount > activeSitesCount
          ? `${totalSitesCount - activeSitesCount} paused`
          : "All live",
      badgeTone: totalSitesCount > activeSitesCount ? "warning" : "success",
    },
    {
      href: "/admin/live-register",
      eyebrow: "People on site",
      value: currentlyOnSiteCount,
      description: "Current occupancy visible to site management.",
      meta: `Around ${liveOccupancyPercent}% of this week's sign-ins are still on site.`,
      badgeLabel: currentlyOnSiteCount > 0 ? "Live register" : "Quiet period",
      badgeTone: currentlyOnSiteCount > 0 ? "success" : "neutral",
    },
    {
      href: "/admin/history",
      eyebrow: "Sign-in velocity",
      value: signInsToday,
      description: "People signed in today across the workspace.",
      meta: `${signInsSevenDays} sign-ins were recorded over the last 7 days.`,
      badgeLabel: signInsToday > 0 ? "Today" : "No new entries",
      badgeTone: signInsToday > 0 ? "info" : "neutral",
    },
  ];
  const coreHealthCards: DashboardMetricCardDefinition[] = [
    {
      href: "/admin/sites",
      eyebrow: "Site readiness",
      value: activeSitesCount,
      valueSuffix: `live`,
      description: "How many sites are actively accepting public sign-ins.",
      meta: `Total configured sites: ${totalSitesCount}.`,
      badgeLabel:
        activeSitesCount === totalSitesCount ? "Stable" : `${totalSitesCount - activeSitesCount} offline`,
      badgeTone: activeSitesCount === totalSitesCount ? "success" : "warning",
    },
    {
      href: "/admin/history",
      eyebrow: "Sign-in throughput",
      value: signInsToday,
      description: "Today's arrival volume across the tenant.",
      meta: `${signInsSevenDays} total sign-ins in the current 7-day window.`,
      badgeLabel: "7 day pulse",
      badgeTone: "info",
    },
    {
      href: "/admin/competency",
      eyebrow: "Documents expiring",
      value: documentsExpiringSoon,
      description: "Compliance evidence due within the next 30 days.",
      meta: `1 day: ${documentExpiryWindows.dueIn1Day} | 7 days: ${documentExpiryWindows.dueIn7Days} | Overdue: ${documentExpiryWindows.overdue}`,
      badgeLabel: documentsExpiringSoon > 0 ? "Needs review" : "Clear",
      badgeTone: documentsExpiringSoon > 0 ? "warning" : "success",
    },
    {
      href: "/admin/history",
      eyebrow: "Location verification",
      value: `${locationCaptureRate}%`,
      description: "Capture rate over the last 30 days.",
      meta: `Within radius: ${locationAuditSummary.withinRadius} | Outside: ${locationAuditSummary.outsideRadius} | Missing: ${locationAuditSummary.withoutCapture}`,
      badgeLabel:
        locationAuditSummary.withoutCapture > 0 || locationAuditSummary.outsideRadius > 0
          ? "Investigate gaps"
          : "Healthy capture",
      badgeTone:
        locationAuditSummary.withoutCapture > 0 || locationAuditSummary.outsideRadius > 0
          ? "warning"
          : "success",
    },
  ];
  const operationalSignalCards: DashboardMetricCardDefinition[] = [
    {
      href: "/admin/actions",
      eyebrow: "Action register",
      value: actionSummary.open,
      description: "Open follow-up items across incidents, hazards, permits, and inspections.",
      meta: `Overdue: ${actionSummary.overdue} | Blocked: ${actionSummary.blocked}`,
      badgeLabel:
        actionSummary.overdue > 0 || actionSummary.blocked > 0
          ? "Escalate"
          : actionSummary.open > 0
            ? "Monitor"
            : "Clear",
      badgeTone:
        actionSummary.overdue > 0 || actionSummary.blocked > 0
          ? "danger"
          : actionSummary.open > 0
            ? "warning"
            : "success",
    },
    {
      href: "/admin/inspections",
      eyebrow: "Inspections",
      value: inspectionSummary.activeSchedules,
      description: "Recurring safety schedules currently in rotation.",
      meta: `Overdue: ${inspectionSummary.overdue} | Failed runs (30d): ${inspectionSummary.failedRuns30Days}`,
      badgeLabel:
        inspectionSummary.overdue > 0 || inspectionSummary.failedRuns30Days > 0
          ? "Attention needed"
          : "Running clean",
      badgeTone:
        inspectionSummary.overdue > 0 || inspectionSummary.failedRuns30Days > 0
          ? "warning"
          : "success",
    },
    {
      href: "/admin/competency",
      eyebrow: "Competency matrix",
      value: competencySummary.expiring,
      description: "Workers with expiring competency evidence in the next 30 days.",
      meta: `Blocked decisions (30d): ${competencySummary.blocked30Days} | Pending verification: ${competencySummary.pendingVerification}`,
      badgeLabel:
        competencySummary.blocked30Days > 0 || competencySummary.pendingVerification > 0
          ? "Verification queue"
          : "Tracking",
      badgeTone:
        competencySummary.blocked30Days > 0 || competencySummary.pendingVerification > 0
          ? "warning"
          : "info",
    },
    {
      href: "/admin/resources",
      eyebrow: "Resource readiness",
      value: resourceSummary.overdueCompliance,
      description: "Assets with overdue inspection or service dates.",
      meta: `Blocked: ${resourceSummary.blocked} | Review required: ${resourceSummary.reviewRequired}`,
      badgeLabel:
        resourceSummary.overdueCompliance > 0 || resourceSummary.blocked > 0
          ? "Service gap"
          : "Ready",
      badgeTone:
        resourceSummary.overdueCompliance > 0 || resourceSummary.blocked > 0
          ? "warning"
          : "success",
    },
    {
      href: "/admin/live-register",
      eyebrow: "Roll-call command",
      value: rollCallSummary.activeEvents,
      description: `Active events across ${rollCallSummary.activeSites} site${rollCallSummary.activeSites === 1 ? "" : "s"}.`,
      meta: `Tracked: ${rollCallSummary.trackedPeople} | Missing: ${rollCallSummary.missingPeople} | Closed (7d): ${rollCallSummary.closedEventsLast7Days}`,
      badgeLabel:
        rollCallSummary.missingPeople > 0
          ? `${rollCallSummary.missingPeople} missing`
          : rollCallSummary.activeEvents > 0
            ? "Event live"
            : "Standby",
      badgeTone:
        rollCallSummary.missingPeople > 0
          ? "danger"
          : rollCallSummary.activeEvents > 0
            ? "warning"
            : "neutral",
    },
    {
      href: "/admin/sites",
      eyebrow: "Drill readiness",
      value: drillSummary.drillsLast30Days,
      description: "Emergency drills completed in the last 30 days.",
      meta: `Due in 7 days: ${drillSummary.dueIn7Days} | Overdue: ${drillSummary.overdueDrills}`,
      badgeLabel: drillSummary.overdueDrills > 0 ? "Overdue drills" : "On schedule",
      badgeTone: drillSummary.overdueDrills > 0 ? "warning" : "success",
    },
  ];
  const quizSummaryCards: DashboardMetricCardDefinition[] = [
    {
      eyebrow: "Scored responses",
      value: quizSummary.scoredResponses30Days,
      description: "Quiz-scored inductions recorded over the last 30 days.",
      badgeLabel: "30 day window",
      badgeTone: "info",
    },
    {
      eyebrow: "Pass rate",
      value: `${quizSummary.passRatePercent}%`,
      description: "Share of recent scored responses that passed on the current attempt profile.",
      meta: `Passed: ${quizSummary.passedResponses30Days} | Failed: ${quizSummary.failedResponses30Days}`,
      badgeLabel:
        quizSummary.passRatePercent >= 90
          ? "Strong"
          : quizSummary.passRatePercent >= 75
            ? "Watch"
            : "Intervene",
      badgeTone:
        quizSummary.passRatePercent >= 90
          ? "success"
          : quizSummary.passRatePercent >= 75
            ? "warning"
            : "danger",
    },
    {
      eyebrow: "Failed responses",
      value: quizSummary.failedResponses30Days,
      description: "Recent failed quiz attempts across active induction templates.",
      meta: `Profiles with failures: ${quizSummary.profilesWithRecentFailures}`,
      badgeLabel:
        quizSummary.failedResponses30Days > 0 ? "Needs review" : "No recent fails",
      badgeTone: quizSummary.failedResponses30Days > 0 ? "warning" : "success",
    },
    {
      eyebrow: "Active cooldowns",
      value: quizSummary.activeCooldowns,
      description: "Participants currently held in a retry cooldown window.",
      meta: `${quizSummary.profilesAttempted30Days} recent attempt profile${quizSummary.profilesAttempted30Days === 1 ? "" : "s"} tracked.`,
      badgeLabel: quizSummary.activeCooldowns > 0 ? "Queue pressure" : "No backlog",
      badgeTone: quizSummary.activeCooldowns > 0 ? "warning" : "neutral",
    },
  ];
  const respondNowTone: StatusBadgeTone = controlRoomActions.some(
    (action) => action.tone === "danger",
  )
    ? "danger"
    : controlRoomActions.some((action) => action.tone === "warning")
      ? "warning"
      : "success";

  return (
    <div className="space-y-6 p-2 sm:p-3">
      <section className="surface-panel-strong overflow-hidden p-5 sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(19rem,0.82fr)] xl:items-start">
          <div className="space-y-5">
            <AdminSectionHeader
              eyebrow="Operator control room"
              title="Dashboard"
              description="See live occupancy, queue pressure, and compliance risk without burying the first screen under equal-weight cards."
              action={
                <StatusBadge tone={liveRiskCount > 0 ? "warning" : "success"}>
                  {liveRiskCount > 0 ? `${liveRiskCount} risks in play` : "Stable now"}
                </StatusBadge>
              }
            />

            <div className="grid gap-3 md:grid-cols-3">
              {primaryMetrics.map((card) => (
                <DashboardMetricCard key={card.eyebrow} card={card} />
              ))}
            </div>
          </div>

          <aside className="admin-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="admin-card-eyebrow">Act now</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">
                  Respond to the queues that change site safety the fastest.
                </p>
                <p className="mt-2 text-sm text-secondary">
                  Keep approvals, actions, and inspections close so operators can move from overview to intervention in one step.
                </p>
              </div>
              <StatusBadge tone={respondNowTone}>Priority stack</StatusBadge>
            </div>

            <ul className="mt-4 space-y-2.5">
              {controlRoomActions.map((action) => (
                <li key={action.href}>
                  <Link
                    href={action.href}
                    className="block rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-3 py-3 transition-colors hover:bg-[color:var(--bg-surface)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                        {action.label}
                      </p>
                      <StatusBadge tone={action.tone}>{action.badgeLabel}</StatusBadge>
                    </div>
                    <p className="mt-2 text-sm text-secondary">{action.detail}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      {metricsLoadFailed ? (
        <Alert variant="warning">
          Dashboard data could not be loaded. Please refresh and try again.
        </Alert>
      ) : null}

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

      <section className="space-y-3">
        <AdminSectionHeader
          eyebrow="Monitor"
          title="Core health"
          description="Track site readiness, arrival throughput, compliance expiry, and location coverage from calmer neutral surfaces."
          action={
            <Link
              href="/admin/live-register"
              className="inline-flex min-h-[38px] items-center rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-strong)]"
            >
              Open live register
            </Link>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {coreHealthCards.map((card) => (
            <DashboardMetricCard key={card.eyebrow} card={card} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <AdminSectionHeader
          eyebrow="Respond and resolve"
          title="Operational signals"
          description="The queues and readiness checks that matter most once the overview says something needs intervention."
          action={
            <Link
              href="/admin/command-mode"
              className="inline-flex min-h-[38px] items-center rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-strong)]"
            >
              Open command mode
            </Link>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {operationalSignalCards.map((card) => (
            <DashboardMetricCard key={card.eyebrow} card={card} />
          ))}
        </div>
      </section>

      <AdminDisclosureSection
        eyebrow="Compliance signals"
        title="Quiz performance signals"
        description="Open pass-rate pressure and cooldown trends only when the overview needs more context."
        summaryMeta={
          <StatusBadge tone={quizSummary.failedResponses30Days > 0 ? "warning" : "neutral"}>
            {quizSummary.failedResponses30Days > 0
              ? `${quizSummary.failedResponses30Days} recent fails`
              : "Quiet now"}
          </StatusBadge>
        }
        tone="subtle"
        action={
          <Link
            href="/admin/templates"
            className="inline-flex min-h-[34px] items-center rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-strong)]"
          >
            Manage templates
          </Link>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quizSummaryCards.map((card) => (
            <DashboardMetricCard key={card.eyebrow} card={card} />
          ))}
        </div>

        <DataTableShell className="mt-4 rounded-none border-0 bg-transparent shadow-none">
          <DataTableScroll
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring-focus)]"
            tabIndex={0}
            role="region"
            aria-labelledby="quiz-performance-signals-heading"
          >
            <DataTable className="data-table-compact data-table-dense">
              <DataTableHeader className="bg-[color:var(--bg-surface)]">
                <DataTableRow>
                  <DataTableHeadCell id="quiz-performance-signals-heading">
                    Template
                  </DataTableHeadCell>
                  <DataTableHeadCell>Site</DataTableHeadCell>
                  <DataTableHeadCell className="text-right">
                    Attempt Profiles
                  </DataTableHeadCell>
                  <DataTableHeadCell className="text-right">
                    Fail Profiles
                  </DataTableHeadCell>
                  <DataTableHeadCell className="text-right">
                    Active Cooldowns
                  </DataTableHeadCell>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {quizSummary.topRiskTemplateSites.length === 0 ? (
                  <DataTableEmptyRow colSpan={5}>
                    No recent quiz attempt pressure detected.
                  </DataTableEmptyRow>
                ) : (
                  quizSummary.topRiskTemplateSites.map((row) => (
                    <DataTableRow key={`${row.template_id}:${row.site_id}`}>
                      <DataTableCell className="font-medium text-[color:var(--text-primary)]">
                        {row.template_name}
                      </DataTableCell>
                      <DataTableCell>{row.site_name}</DataTableCell>
                      <DataTableCell className="text-right text-[color:var(--text-primary)]">
                        {row.recent_attempt_profiles}
                      </DataTableCell>
                      <DataTableCell className="text-right text-[color:var(--text-primary)]">
                        {row.recent_fail_profiles}
                      </DataTableCell>
                      <DataTableCell className="text-right text-[color:var(--text-primary)]">
                        {row.active_cooldowns}
                      </DataTableCell>
                    </DataTableRow>
                  ))
                )}
              </DataTableBody>
            </DataTable>
          </DataTableScroll>
        </DataTableShell>
      </AdminDisclosureSection>

      {(canManageContractors || canManageUsers) && (
        <AdminDisclosureSection
          eyebrow="Administration"
          title="Management shortcuts"
          description="Keep high-frequency configuration pages close without turning the dashboard into another settings index."
          summaryMeta={
            <StatusBadge tone="neutral">
              {canManageContractors && canManageUsers ? "2 shortcuts" : "1 shortcut"}
            </StatusBadge>
          }
          tone="subtle"
        >
          <div className="grid gap-4 md:grid-cols-2">
            {canManageContractors ? (
              <Link href="/admin/contractors" className="admin-card-link h-full">
                <p className="admin-card-eyebrow">Contractors</p>
                <p className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">
                  View and manage contractor records
                </p>
                <p className="admin-card-support">
                  Keep details current, compliant, and ready for site access.
                </p>
              </Link>
            ) : null}
            {canManageUsers ? (
              <Link href="/admin/users" className="admin-card-link h-full">
                <p className="admin-card-eyebrow">Users</p>
                <p className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">
                  View roles and account status
                </p>
                <p className="admin-card-support">
                  Manage access, permissions, and account state from one place.
                </p>
              </Link>
            ) : null}
          </div>
        </AdminDisclosureSection>
      )}

      <AdminDisclosureSection
        eyebrow="Recent signals"
        title="Activity and arrivals"
        description="Open recent movement, audit actions, and host alerts only when the overview needs more detail."
        summaryMeta={
          <StatusBadge tone="neutral">
            {recentSignIns.length + recentAuditLogs.length + hostArrivalNotifications.length} items
          </StatusBadge>
        }
        tone="subtle"
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="surface-panel overflow-hidden">
            <div className="border-b border-surface-soft px-5 py-4">
              <p className="admin-card-eyebrow">Recent sign-ins</p>
              <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">
                Latest arrivals
              </p>
            </div>
            <div className="p-5">
              {recentSignIns.length === 0 ? (
                <p className="text-sm text-secondary">No recent sign-ins.</p>
              ) : (
                <ul className="divide-y divide-[color:var(--border-soft)]">
                  {recentSignIns.map((record) => (
                    <li key={record.id} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                            {record.visitor_name}
                          </p>
                          <p className="truncate text-sm text-secondary">
                            {record.site.name}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-muted">
                            {new Date(record.sign_in_ts).toLocaleString()}
                          </p>
                          {!record.sign_out_ts ? (
                            <StatusBadge tone="success" className="mt-1">
                              On site
                            </StatusBadge>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="surface-panel overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-surface-soft px-5 py-4">
              <div>
                <p className="admin-card-eyebrow">Recent activity</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">
                  Audit trail snapshots
                </p>
              </div>
              <Link
                href="/admin/audit-log"
                className="inline-flex min-h-[34px] items-center rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-secondary hover:bg-[color:var(--bg-surface-strong)]"
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
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                            {formatAuditAction(log.action)}
                          </p>
                          <p className="truncate text-sm text-secondary">
                            by {log.user?.name || "System"}
                          </p>
                        </div>
                        <p className="shrink-0 text-xs text-muted">
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
            <div className="flex items-start justify-between gap-3 border-b border-surface-soft px-5 py-4">
              <div>
                <p className="admin-card-eyebrow">Arrival alerts</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">
                  Host notifications
                </p>
              </div>
              <StatusBadge tone="info">In app</StatusBadge>
            </div>
            <div className="p-5">
              {hostArrivalNotifications.length === 0 ? (
                <p className="text-sm text-secondary">No host arrival alerts yet.</p>
              ) : (
                <ul className="divide-y divide-[color:var(--border-soft)]">
                  {hostArrivalNotifications.map((notification) => (
                    <li key={notification.id} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                            {notification.visitor_name}
                          </p>
                          <p className="truncate text-sm text-secondary">
                            {notification.site_name}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {notification.targeted
                              ? "Targeted to you"
                              : "Broadcast to site managers"}
                          </p>
                        </div>
                        <p className="shrink-0 text-xs text-muted">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </AdminDisclosureSection>
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


