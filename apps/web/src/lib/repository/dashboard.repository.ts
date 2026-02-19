import { scopedDb } from "@/lib/db/scoped-db";
import { requireCompanyId, handlePrismaError } from "./base";

export interface DashboardMetrics {
  activeSitesCount: number;
  totalSitesCount: number;
  currentlyOnSiteCount: number;
  signInsToday: number;
  signInsSevenDays: number;
  documentsExpiringSoon: number;
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

export async function getDashboardMetrics(
  companyId: string,
  opts: { now?: Date } = {},
): Promise<DashboardMetrics> {
  requireCompanyId(companyId);

  const db = scopedDb(companyId);
  const now = opts.now ?? new Date();
  const todayStartUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const sevenDaysAgoUtc = new Date(todayStartUtc);
  sevenDaysAgoUtc.setUTCDate(sevenDaysAgoUtc.getUTCDate() - 7);
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  try {
    const [
      activeSitesCount,
      totalSitesCount,
      currentlyOnSiteCount,
      signInsToday,
      signInsSevenDays,
      documentsExpiringSoon,
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
      db.contractorDocument.count({
        where: {
          contractor: { company_id: companyId },
          expires_at: { lte: thirtyDaysFromNow, gte: now },
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

    return {
      activeSitesCount,
      totalSitesCount,
      currentlyOnSiteCount,
      signInsToday,
      signInsSevenDays,
      documentsExpiringSoon,
      recentSignIns,
      recentAuditLogs,
    };
  } catch (error) {
    handlePrismaError(error, "Dashboard");
  }
}
