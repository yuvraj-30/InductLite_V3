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
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
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
        where: { company_id: companyId, sign_in_ts: { gte: todayStart } },
      }),
      db.signInRecord.count({
        where: { company_id: companyId, sign_in_ts: { gte: sevenDaysAgo } },
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
        include: { site: { select: { name: true } } },
      }),
      db.auditLog.findMany({
        where: { company_id: companyId },
        orderBy: { created_at: "desc" },
        take: 5,
        include: { user: { select: { name: true } } },
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
