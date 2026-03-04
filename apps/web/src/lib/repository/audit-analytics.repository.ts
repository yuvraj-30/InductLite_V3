import { scopedDb } from "@/lib/db/scoped-db";
import { handlePrismaError, requireCompanyId } from "./base";

export interface AdvancedAuditAnalytics {
  totalEvents30Days: number;
  uniqueActorCount30Days: number;
  systemEventCount30Days: number;
  afterHoursEventCount30Days: number;
  failedLoginCount30Days: number;
  escalationEventCount30Days: number;
  exportDownloadCount30Days: number;
  smsSentCount30Days: number;
  smsFailedCount30Days: number;
  hardwareDeniedCount30Days: number;
  topActions: Array<{
    action: string;
    count: number;
    percentage: number;
  }>;
  topIpAddresses: Array<{
    ipAddress: string;
    count: number;
  }>;
  dailyEventTrend: Array<{
    day: string;
    count: number;
  }>;
}

function getLocalHour(value: Date, timeZone: string): number {
  const hourString = new Intl.DateTimeFormat("en-NZ", {
    hour: "2-digit",
    hour12: false,
    timeZone,
  }).format(value);
  return Number.parseInt(hourString, 10);
}

function getLocalDayKey(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export async function getAdvancedAuditAnalytics(
  companyId: string,
  options: {
    now?: Date;
    windowDays?: number;
    timezone?: string;
  } = {},
): Promise<AdvancedAuditAnalytics> {
  requireCompanyId(companyId);

  const now = options.now ?? new Date();
  const windowDays = Math.max(1, Math.min(options.windowDays ?? 30, 90));
  const timezone = options.timezone ?? "Pacific/Auckland";
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  try {
    const db = scopedDb(companyId);
    const logs = await db.auditLog.findMany({
      where: {
        company_id: companyId,
        created_at: { gte: since },
      },
      select: {
        action: true,
        user_id: true,
        ip_address: true,
        created_at: true,
        details: true,
      },
      orderBy: { created_at: "asc" },
      take: 20_000,
    });

    const actionCounts = new Map<string, number>();
    const ipCounts = new Map<string, number>();
    const dayCounts = new Map<string, number>();
    const actorIds = new Set<string>();

    let systemEventCount30Days = 0;
    let afterHoursEventCount30Days = 0;
    let failedLoginCount30Days = 0;
    let escalationEventCount30Days = 0;
    let exportDownloadCount30Days = 0;
    let smsSentCount30Days = 0;
    let smsFailedCount30Days = 0;
    let hardwareDeniedCount30Days = 0;

    for (const log of logs) {
      actionCounts.set(log.action, (actionCounts.get(log.action) ?? 0) + 1);
      if (log.ip_address) {
        ipCounts.set(log.ip_address, (ipCounts.get(log.ip_address) ?? 0) + 1);
      }

      if (log.user_id) {
        actorIds.add(log.user_id);
      } else {
        systemEventCount30Days += 1;
      }

      const localHour = getLocalHour(log.created_at, timezone);
      if (localHour < 6 || localHour >= 20) {
        afterHoursEventCount30Days += 1;
      }

      const dayKey = getLocalDayKey(log.created_at, timezone);
      dayCounts.set(dayKey, (dayCounts.get(dayKey) ?? 0) + 1);

      if (log.action === "auth.login_failed") {
        failedLoginCount30Days += 1;
      }
      if (
        log.action === "visitor.sign_in_escalation_submitted" ||
        log.action === "visitor.sign_in_escalation_denied"
      ) {
        escalationEventCount30Days += 1;
      }
      if (log.action === "export.download") {
        exportDownloadCount30Days += 1;
      }
      if (log.action === "sms.sent") {
        smsSentCount30Days += 1;
      }
      if (log.action === "sms.failed") {
        smsFailedCount30Days += 1;
      }
      if (log.action === "hardware.access_queued") {
        const details =
          log.details && typeof log.details === "object" && !Array.isArray(log.details)
            ? (log.details as Record<string, unknown>)
            : null;
        if (details?.decision === "DENY") {
          hardwareDeniedCount30Days += 1;
        }
      }
    }

    const totalEvents30Days = logs.length;
    const topActions = [...actionCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10)
      .map(([action, count]) => ({
        action,
        count,
        percentage:
          totalEvents30Days > 0
            ? Math.round((count / totalEvents30Days) * 1000) / 10
            : 0,
      }));
    const topIpAddresses = [...ipCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10)
      .map(([ipAddress, count]) => ({ ipAddress, count }));
    const dailyEventTrend = [...dayCounts.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([day, count]) => ({ day, count }));

    return {
      totalEvents30Days,
      uniqueActorCount30Days: actorIds.size,
      systemEventCount30Days,
      afterHoursEventCount30Days,
      failedLoginCount30Days,
      escalationEventCount30Days,
      exportDownloadCount30Days,
      smsSentCount30Days,
      smsFailedCount30Days,
      hardwareDeniedCount30Days,
      topActions,
      topIpAddresses,
      dailyEventTrend,
    };
  } catch (error) {
    handlePrismaError(error, "AuditLog");
  }
}
