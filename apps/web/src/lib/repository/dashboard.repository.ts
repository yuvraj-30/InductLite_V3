import { scopedDb } from "@/lib/db/scoped-db";
import { requireCompanyId, handlePrismaError } from "./base";
import type { UserRole } from "@prisma/client";

export interface DashboardMetrics {
  activeSitesCount: number;
  totalSitesCount: number;
  currentlyOnSiteCount: number;
  signInsToday: number;
  signInsSevenDays: number;
  documentsExpiringSoon: number;
  documentExpiryWindows: {
    overdue: number;
    dueIn1Day: number;
    dueIn7Days: number;
    dueIn14Days: number;
    dueIn30Days: number;
  };
  locationAuditSummary: {
    totalSignIns30Days: number;
    captured: number;
    withinRadius: number;
    outsideRadius: number;
    withoutCapture: number;
  };
  rollCallSummary: {
    activeEvents: number;
    activeSites: number;
    trackedPeople: number;
    missingPeople: number;
    closedEventsLast7Days: number;
  };
  drillSummary: {
    drillsLast30Days: number;
    overdueDrills: number;
    dueIn7Days: number;
  };
  approvalSummary: {
    pending: number;
    deniedLast7Days: number;
    watchlistPending: number;
    randomCheckPending: number;
    averagePendingMinutes: number;
  };
  permitSummary: {
    requested: number;
    active: number;
    suspended: number;
    overdue: number;
  };
  actionSummary: {
    open: number;
    overdue: number;
    blocked: number;
  };
  inspectionSummary: {
    activeSchedules: number;
    overdue: number;
    failedRuns30Days: number;
  };
  competencySummary: {
    blocked30Days: number;
    expiring: number;
    pendingVerification: number;
  };
  resourceSummary: {
    blocked: number;
    reviewRequired: number;
    overdueCompliance: number;
  };
  quizSummary: {
    scoredResponses30Days: number;
    passedResponses30Days: number;
    failedResponses30Days: number;
    passRatePercent: number;
    activeCooldowns: number;
    profilesAttempted30Days: number;
    profilesWithRecentFailures: number;
    topRiskTemplateSites: Array<{
      template_id: string;
      template_name: string;
      site_id: string;
      site_name: string;
      recent_attempt_profiles: number;
      recent_fail_profiles: number;
      active_cooldowns: number;
    }>;
  };
  hostArrivalNotifications: Array<{
    id: string;
    created_at: Date;
    visitor_name: string;
    site_name: string;
    targeted: boolean;
  }>;
  recentSignIns: Array<{
    id: string;
    visitor_name: string;
    visitor_type: string;
    sign_in_ts: Date;
    sign_out_ts: Date | null;
    site: { name: string };
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    created_at: Date;
    user: { name: string } | null;
  }>;
}

export interface OnboardingProgress {
  totalSitesCount: number;
  publishedTemplatesCount: number;
  totalSignInsCount: number;
  hasSites: boolean;
  hasPublishedTemplate: boolean;
  hasFirstSignIn: boolean;
  onboardingComplete: boolean;
}

export async function getDashboardMetrics(
  companyId: string,
  opts: { now?: Date; userId?: string; userRole?: UserRole } = {},
): Promise<DashboardMetrics> {
  requireCompanyId(companyId);

  const db = scopedDb(companyId);
  const now = opts.now ?? new Date();
  const todayStartUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const sevenDaysAgoUtc = new Date(todayStartUtc);
  sevenDaysAgoUtc.setUTCDate(sevenDaysAgoUtc.getUTCDate() - 7);
  const thirtyDaysAgoUtc = new Date(todayStartUtc);
  thirtyDaysAgoUtc.setUTCDate(thirtyDaysAgoUtc.getUTCDate() - 30);
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const fourteenDaysFromNow = new Date(now);
  fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const oneDayFromNow = new Date(now);
  oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);
  const userRole = opts.userRole ?? "VIEWER";
  const userId = opts.userId;

  try {
    const [
      activeSitesCount,
      totalSitesCount,
      currentlyOnSiteCount,
      signInsToday,
      signInsSevenDays,
      signInsThirtyDays,
      locationCapturedThirtyDays,
      locationWithinRadiusThirtyDays,
      locationOutsideRadiusThirtyDays,
      expiringDocuments,
      activeRollCallEvents,
      closedRollCallsLast7Days,
      drillsLast30Days,
      overdueDrills,
      dueDrillsIn7Days,
      pendingApprovalRequests,
      deniedApprovalRequestsLast7Days,
      permitRequestsInFlight,
      openActions,
      overdueActions,
      blockedActions,
      activeInspectionSchedules,
      overdueInspectionSchedules,
      failedInspectionRuns30Days,
      blockedCompetencyDecisions30Days,
      expiringWorkerCertifications,
      pendingVerificationCertifications,
      blockedResources,
      reviewRequiredResources,
      overdueResources,
      quizActiveCooldowns,
      quizProfilesAttempted30Days,
      quizProfilesWithRecentFailures,
      quizAttemptProfiles30Days,
      quizSignInAuditLogs,
      hostArrivalAuditLogs,
      recentSignIns,
      recentAuditLogs,
    ] = await Promise.all([
      db.site.count({ where: { company_id: companyId, is_active: true } }),
      db.site.count({ where: { company_id: companyId } }),
      db.signInRecord.count({
        where: { company_id: companyId, sign_out_ts: null },
      }),
      db.signInRecord.count({
        where: { company_id: companyId, sign_in_ts: { gte: todayStartUtc } },
      }),
      db.signInRecord.count({
        where: { company_id: companyId, sign_in_ts: { gte: sevenDaysAgoUtc } },
      }),
      db.signInRecord.count({
        where: { company_id: companyId, sign_in_ts: { gte: thirtyDaysAgoUtc } },
      }),
      db.signInRecord.count({
        where: {
          company_id: companyId,
          sign_in_ts: { gte: thirtyDaysAgoUtc },
          location_captured_at: { not: null },
        },
      }),
      db.signInRecord.count({
        where: {
          company_id: companyId,
          sign_in_ts: { gte: thirtyDaysAgoUtc },
          location_within_radius: true,
        },
      }),
      db.signInRecord.count({
        where: {
          company_id: companyId,
          sign_in_ts: { gte: thirtyDaysAgoUtc },
          location_within_radius: false,
        },
      }),
      db.contractorDocument.findMany({
        where: {
          contractor: { company_id: companyId },
          expires_at: { lte: thirtyDaysFromNow },
        },
        select: { expires_at: true },
      }),
      db.evacuationEvent.findMany({
        where: {
          company_id: companyId,
          status: "ACTIVE",
        },
        select: {
          site_id: true,
          total_people: true,
          missing_count: true,
        },
      }),
      db.evacuationEvent.count({
        where: {
          company_id: companyId,
          status: "CLOSED",
          closed_at: { gte: sevenDaysAgoUtc },
        },
      }),
      db.emergencyDrill.count({
        where: {
          company_id: companyId,
          conducted_at: { gte: thirtyDaysAgoUtc },
        },
      }),
      db.emergencyDrill.count({
        where: {
          company_id: companyId,
          next_due_at: { lt: now },
        },
      }),
      db.emergencyDrill.count({
        where: {
          company_id: companyId,
          next_due_at: {
            gte: now,
            lte: sevenDaysFromNow,
          },
        },
      }),
      db.visitorApprovalRequest.findMany({
        where: {
          company_id: companyId,
          status: "PENDING",
        },
        select: {
          requested_at: true,
          watchlist_match: true,
          random_check_triggered: true,
        },
      }),
      db.visitorApprovalRequest.count({
        where: {
          company_id: companyId,
          status: "DENIED",
          reviewed_at: { gte: sevenDaysAgoUtc },
        },
      }),
      db.permitRequest.findMany({
        where: {
          company_id: companyId,
          status: {
            in: ["REQUESTED", "APPROVED", "ACTIVE", "SUSPENDED"],
          },
        },
        select: {
          status: true,
          validity_end: true,
        },
      }),
      db.actionRegisterEntry.count({
        where: {
          company_id: companyId,
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
      }),
      db.actionRegisterEntry.count({
        where: {
          company_id: companyId,
          status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] },
          due_at: { lt: now },
        },
      }),
      db.actionRegisterEntry.count({
        where: {
          company_id: companyId,
          status: "BLOCKED",
        },
      }),
      db.inspectionSchedule.count({
        where: {
          company_id: companyId,
          is_active: true,
        },
      }),
      db.inspectionSchedule.count({
        where: {
          company_id: companyId,
          is_active: true,
          next_due_at: { lt: now },
        },
      }),
      db.inspectionRun.count({
        where: {
          company_id: companyId,
          status: "COMPLETED",
          failed_item_count: { gt: 0 },
          completed_at: { gte: thirtyDaysAgoUtc },
        },
      }),
      db.competencyDecision.count({
        where: {
          company_id: companyId,
          status: "BLOCKED",
          decided_at: { gte: thirtyDaysAgoUtc },
        },
      }),
      db.workerCertification.count({
        where: {
          company_id: companyId,
          OR: [
            { status: "EXPIRING" },
            {
              status: "CURRENT",
              expires_at: { gt: now, lte: thirtyDaysFromNow },
            },
          ],
        },
      }),
      db.workerCertification.count({
        where: {
          company_id: companyId,
          status: "PENDING_VERIFICATION",
        },
      }),
      db.bookableResource.count({
        where: {
          company_id: companyId,
          is_active: true,
          readiness_status: "BLOCKED",
        },
      }),
      db.bookableResource.count({
        where: {
          company_id: companyId,
          is_active: true,
          readiness_status: "REVIEW_REQUIRED",
        },
      }),
      db.bookableResource.count({
        where: {
          company_id: companyId,
          is_active: true,
          OR: [
            { inspection_due_at: { lte: now } },
            { service_due_at: { lte: now } },
          ],
        },
      }),
      db.inductionQuizAttempt.count({
        where: {
          cooldown_until: { gt: now },
        },
      }),
      db.inductionQuizAttempt.count({
        where: {
          last_attempt_at: { gte: thirtyDaysAgoUtc },
        },
      }),
      db.inductionQuizAttempt.count({
        where: {
          last_attempt_at: { gte: thirtyDaysAgoUtc },
          last_passed: false,
        },
      }),
      db.inductionQuizAttempt.findMany({
        where: {
          last_attempt_at: { gte: thirtyDaysAgoUtc },
        },
        select: {
          template_id: true,
          site_id: true,
          last_passed: true,
          cooldown_until: true,
          template: {
            select: {
              name: true,
            },
          },
          site: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          last_attempt_at: "desc",
        },
        take: 2_000,
      }),
      db.auditLog.findMany({
        where: {
          company_id: companyId,
          action: "visitor.sign_in",
          created_at: { gte: thirtyDaysAgoUtc },
        },
        select: {
          details: true,
        },
        orderBy: { created_at: "desc" },
        take: 2_000,
      }),
      db.auditLog.findMany({
        where: {
          company_id: companyId,
          action: "visitor.sign_in",
        },
        orderBy: { created_at: "desc" },
        take: 40,
        select: {
          id: true,
          created_at: true,
          details: true,
        },
      }),
      db.signInRecord.findMany({
        where: { company_id: companyId },
        orderBy: { sign_in_ts: "desc" },
        take: 5,
        select: {
          id: true,
          visitor_name: true,
          visitor_type: true,
          sign_in_ts: true,
          sign_out_ts: true,
          site: { select: { name: true } },
        },
      }),
      db.auditLog.findMany({
        where: { company_id: companyId },
        orderBy: { created_at: "desc" },
        take: 5,
        select: {
          id: true,
          action: true,
          created_at: true,
          user: { select: { name: true } },
        },
      }),
    ]);

    const documentExpiryWindows = expiringDocuments.reduce(
      (acc, row) => {
        if (!row.expires_at) {
          return acc;
        }

        if (row.expires_at < now) {
          acc.overdue += 1;
          return acc;
        }

        if (row.expires_at <= oneDayFromNow) {
          acc.dueIn1Day += 1;
        }
        if (row.expires_at <= sevenDaysFromNow) {
          acc.dueIn7Days += 1;
        }
        if (row.expires_at <= fourteenDaysFromNow) {
          acc.dueIn14Days += 1;
        }
        if (row.expires_at <= thirtyDaysFromNow) {
          acc.dueIn30Days += 1;
        }

        return acc;
      },
      {
        overdue: 0,
        dueIn1Day: 0,
        dueIn7Days: 0,
        dueIn14Days: 0,
        dueIn30Days: 0,
      },
    );

    const rollCallSummary = {
      activeEvents: activeRollCallEvents.length,
      activeSites: new Set(activeRollCallEvents.map((event) => event.site_id)).size,
      trackedPeople: activeRollCallEvents.reduce(
        (acc, event) => acc + event.total_people,
        0,
      ),
      missingPeople: activeRollCallEvents.reduce(
        (acc, event) => acc + event.missing_count,
        0,
      ),
      closedEventsLast7Days: closedRollCallsLast7Days,
    };

    const drillSummary = {
      drillsLast30Days,
      overdueDrills,
      dueIn7Days: dueDrillsIn7Days,
    };
    const approvalSummary = {
      pending: pendingApprovalRequests.length,
      deniedLast7Days: deniedApprovalRequestsLast7Days,
      watchlistPending: pendingApprovalRequests.filter(
        (request) => request.watchlist_match,
      ).length,
      randomCheckPending: pendingApprovalRequests.filter(
        (request) => request.random_check_triggered,
      ).length,
      averagePendingMinutes:
        pendingApprovalRequests.length > 0
          ? Math.round(
              pendingApprovalRequests.reduce((acc, request) => {
                return (
                  acc +
                  Math.max(
                    0,
                    Math.floor(
                      (now.getTime() - request.requested_at.getTime()) / 60000,
                    ),
                  )
                );
              }, 0) / pendingApprovalRequests.length,
            )
          : 0,
    };
    const permitSummary = {
      requested: permitRequestsInFlight.filter(
        (request) => request.status === "REQUESTED",
      ).length,
      active: permitRequestsInFlight.filter((request) =>
        request.status === "APPROVED" || request.status === "ACTIVE",
      ).length,
      suspended: permitRequestsInFlight.filter(
        (request) => request.status === "SUSPENDED",
      ).length,
      overdue: permitRequestsInFlight.filter(
        (request) =>
          request.validity_end !== null &&
          request.validity_end.getTime() < now.getTime(),
      ).length,
    };
    const actionSummary = {
      open: openActions,
      overdue: overdueActions,
      blocked: blockedActions,
    };
    const inspectionSummary = {
      activeSchedules: activeInspectionSchedules,
      overdue: overdueInspectionSchedules,
      failedRuns30Days: failedInspectionRuns30Days,
    };
    const competencySummary = {
      blocked30Days: blockedCompetencyDecisions30Days,
      expiring: expiringWorkerCertifications,
      pendingVerification: pendingVerificationCertifications,
    };
    const resourceSummary = {
      blocked: blockedResources,
      reviewRequired: reviewRequiredResources,
      overdueCompliance: overdueResources,
    };
    const quizScoredResponses30Days = quizSignInAuditLogs.reduce(
      (acc: number, row: { details: unknown }) => {
        const details =
          row.details && typeof row.details === "object" && !Array.isArray(row.details)
            ? (row.details as Record<string, unknown>)
            : null;
        if (!details || details.quiz_scoring_enabled !== true) {
          return acc;
        }
        return acc + 1;
      },
      0,
    );
    const quizPassedResponses30Days = quizSignInAuditLogs.reduce(
      (acc: number, row: { details: unknown }) => {
        const details =
          row.details && typeof row.details === "object" && !Array.isArray(row.details)
            ? (row.details as Record<string, unknown>)
            : null;
        if (!details || details.quiz_scoring_enabled !== true) {
          return acc;
        }
        return acc + (details.quiz_passed === true ? 1 : 0);
      },
      0,
    );
    const quizFailedResponses30Days = Math.max(
      quizScoredResponses30Days - quizPassedResponses30Days,
      0,
    );
    const quizPassRatePercent =
      quizScoredResponses30Days > 0
        ? Math.round((quizPassedResponses30Days / quizScoredResponses30Days) * 100)
        : 0;
    const topRiskTemplateSiteMap = new Map<
      string,
      {
        template_id: string;
        template_name: string;
        site_id: string;
        site_name: string;
        recent_attempt_profiles: number;
        recent_fail_profiles: number;
        active_cooldowns: number;
      }
    >();

    for (const row of quizAttemptProfiles30Days) {
      const key = `${row.template_id}:${row.site_id}`;
      const existing = topRiskTemplateSiteMap.get(key);
      const next = existing ?? {
        template_id: row.template_id,
        template_name: row.template.name,
        site_id: row.site_id,
        site_name: row.site.name,
        recent_attempt_profiles: 0,
        recent_fail_profiles: 0,
        active_cooldowns: 0,
      };

      next.recent_attempt_profiles += 1;
      if (row.last_passed === false) {
        next.recent_fail_profiles += 1;
      }
      if (row.cooldown_until && row.cooldown_until.getTime() > now.getTime()) {
        next.active_cooldowns += 1;
      }

      topRiskTemplateSiteMap.set(key, next);
    }

    const topRiskTemplateSites = [...topRiskTemplateSiteMap.values()]
      .sort((left, right) => {
        if (right.recent_fail_profiles !== left.recent_fail_profiles) {
          return right.recent_fail_profiles - left.recent_fail_profiles;
        }
        if (right.active_cooldowns !== left.active_cooldowns) {
          return right.active_cooldowns - left.active_cooldowns;
        }
        return right.recent_attempt_profiles - left.recent_attempt_profiles;
      })
      .slice(0, 5);

    const quizSummary = {
      scoredResponses30Days: quizScoredResponses30Days,
      passedResponses30Days: quizPassedResponses30Days,
      failedResponses30Days: quizFailedResponses30Days,
      passRatePercent: quizPassRatePercent,
      activeCooldowns: quizActiveCooldowns,
      profilesAttempted30Days: quizProfilesAttempted30Days,
      profilesWithRecentFailures: quizProfilesWithRecentFailures,
      topRiskTemplateSites,
    };
    const locationAuditSummary = {
      totalSignIns30Days: signInsThirtyDays,
      captured: locationCapturedThirtyDays,
      withinRadius: locationWithinRadiusThirtyDays,
      outsideRadius: locationOutsideRadiusThirtyDays,
      withoutCapture: Math.max(signInsThirtyDays - locationCapturedThirtyDays, 0),
    };

    const hostArrivalNotifications = hostArrivalAuditLogs
      .map((row) => {
        const details =
          row.details && typeof row.details === "object" && !Array.isArray(row.details)
            ? (row.details as Record<string, unknown>)
            : null;
        if (!details) {
          return null;
        }

        const visitorName =
          typeof details.visitor_name === "string" ? details.visitor_name : null;
        const siteName =
          typeof details.site_name === "string" ? details.site_name : null;
        const queuedCount =
          typeof details.host_notifications_queued === "number"
            ? details.host_notifications_queued
            : 0;
        const notificationsEnabled = details.host_notifications_enabled === true;
        const hostRecipientId =
          typeof details.host_recipient_id === "string"
            ? details.host_recipient_id
            : null;

        if (!notificationsEnabled || queuedCount <= 0 || !visitorName || !siteName) {
          return null;
        }

        const targeted =
          hostRecipientId !== null && userId !== undefined && hostRecipientId === userId;

        const visibleToUser =
          userRole === "ADMIN"
            ? true
            : hostRecipientId
              ? targeted
              : userRole === "SITE_MANAGER";

        if (!visibleToUser) {
          return null;
        }

        return {
          id: row.id,
          created_at: row.created_at,
          visitor_name: visitorName,
          site_name: siteName,
          targeted,
        };
      })
      .filter(
        (
          row,
        ): row is {
          id: string;
          created_at: Date;
          visitor_name: string;
          site_name: string;
          targeted: boolean;
        } => row !== null,
      )
      .slice(0, 8);

    return {
      activeSitesCount,
      totalSitesCount,
      currentlyOnSiteCount,
      signInsToday,
      signInsSevenDays,
      documentsExpiringSoon: documentExpiryWindows.dueIn30Days,
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
    };
  } catch (error) {
    handlePrismaError(error, "Dashboard");
  }
}

export async function getOnboardingProgress(
  companyId: string,
): Promise<OnboardingProgress> {
  requireCompanyId(companyId);

  const db = scopedDb(companyId);

  try {
    const [totalSitesCount, publishedTemplatesCount, totalSignInsCount] =
      await Promise.all([
        db.site.count({ where: { company_id: companyId } }),
        db.inductionTemplate.count({
          where: {
            company_id: companyId,
            is_published: true,
            is_archived: false,
          },
        }),
        db.signInRecord.count({ where: { company_id: companyId } }),
      ]);

    const hasSites = totalSitesCount > 0;
    const hasPublishedTemplate = publishedTemplatesCount > 0;
    const hasFirstSignIn = totalSignInsCount > 0;
    const onboardingComplete =
      hasSites && hasPublishedTemplate && hasFirstSignIn;

    return {
      totalSitesCount,
      publishedTemplatesCount,
      totalSignInsCount,
      hasSites,
      hasPublishedTemplate,
      hasFirstSignIn,
      onboardingComplete,
    };
  } catch (error) {
    handlePrismaError(error, "Dashboard");
  }
}
