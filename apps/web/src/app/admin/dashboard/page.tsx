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
import { checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Dashboard | InductLite",
};

export default async function AdminDashboardPage() {
  // Check auth - ADMIN or VIEWER can view dashboard
  const result = await checkPermissionReadOnly("audit:read");
  if (!result.success) {
    if (result.code === "UNAUTHENTICATED") redirect("/login");
    if (result.code === "FORBIDDEN") redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const companyId = context.companyId;

  // Calculate date ranges
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  // Fetch all KPIs in parallel
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
    // Active sites count
    prisma.site.count({
      where: { company_id: companyId, is_active: true },
    }),

    // Total sites count
    prisma.site.count({
      where: { company_id: companyId },
    }),

    // Currently on-site (signed in but not signed out)
    prisma.signInRecord.count({
      where: {
        company_id: companyId,
        sign_out_ts: null,
      },
    }),

    // Sign-ins today
    prisma.signInRecord.count({
      where: {
        company_id: companyId,
        sign_in_ts: { gte: todayStart },
      },
    }),

    // Sign-ins last 7 days
    prisma.signInRecord.count({
      where: {
        company_id: companyId,
        sign_in_ts: { gte: sevenDaysAgo },
      },
    }),

    // Documents expiring within 30 days
    prisma.contractorDocument.count({
      where: {
        contractor: { company_id: companyId },
        expires_at: {
          lte: thirtyDaysFromNow,
          gte: now,
        },
      },
    }),

    // Recent sign-ins
    prisma.signInRecord.findMany({
      where: { company_id: companyId },
      orderBy: { sign_in_ts: "desc" },
      take: 5,
      include: {
        site: { select: { name: true } },
      },
    }),

    // Recent audit logs
    prisma.auditLog.findMany({
      where: { company_id: companyId },
      orderBy: { created_at: "desc" },
      take: 5,
      include: {
        user: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Overview of your sites and contractors
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Active Sites */}
        <Link
          href="/admin/sites"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg
                  className="h-6 w-6 text-blue-600"
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
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Sites</p>
              <p className="text-2xl font-semibold text-gray-900">
                {activeSitesCount}
                <span className="text-sm text-gray-500 font-normal">
                  {" "}
                  / {totalSitesCount}
                </span>
              </p>
            </div>
          </div>
        </Link>

        {/* Currently On-Site */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 bg-green-100 rounded-lg">
                <svg
                  className="h-6 w-6 text-green-600"
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
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">
                Currently On-Site
              </p>
              <p className="text-2xl font-semibold text-green-600">
                {currentlyOnSiteCount}
              </p>
            </div>
          </div>
        </div>

        {/* Sign-Ins Today / 7 Days */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg
                  className="h-6 w-6 text-purple-600"
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
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Sign-Ins</p>
              <p className="text-2xl font-semibold text-gray-900">
                {signInsToday}
                <span className="text-sm text-gray-500 font-normal">
                  {" "}
                  today
                </span>
              </p>
              <p className="text-sm text-gray-500">
                {signInsSevenDays} in last 7 days
              </p>
            </div>
          </div>
        </div>

        {/* Documents Expiring Soon */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div
                className={`p-3 rounded-lg ${documentsExpiringSoon > 0 ? "bg-yellow-100" : "bg-gray-100"}`}
              >
                <svg
                  className={`h-6 w-6 ${documentsExpiringSoon > 0 ? "text-yellow-600" : "text-gray-600"}`}
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
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Docs Expiring</p>
              <p
                className={`text-2xl font-semibold ${documentsExpiringSoon > 0 ? "text-yellow-600" : "text-gray-900"}`}
              >
                {documentsExpiringSoon}
              </p>
              <p className="text-sm text-gray-500">within 30 days</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sign-Ins */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Recent Sign-Ins
            </h2>
          </div>
          <div className="p-6">
            {recentSignIns.length === 0 ? (
              <p className="text-gray-500 text-sm">No recent sign-ins.</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {recentSignIns.map((record) => (
                  <li key={record.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {record.visitor_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {record.site.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {new Date(record.sign_in_ts).toLocaleString()}
                        </p>
                        {!record.sign_out_ts && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
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

        {/* Recent Audit Logs */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">
              Recent Activity
            </h2>
            <Link
              href="/admin/audit-log"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View all
            </Link>
          </div>
          <div className="p-6">
            {recentAuditLogs.length === 0 ? (
              <p className="text-gray-500 text-sm">No recent activity.</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {recentAuditLogs.map((log) => (
                  <li key={log.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {formatAuditAction(log.action)}
                        </p>
                        <p className="text-sm text-gray-500">
                          by {log.user?.name || "System"}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
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
    "signin.create": "Contractor signed in",
    "signin.signout": "Contractor signed out",
  };

  return actionMap[action] || action.replace(".", " ").replace(/_/g, " ");
}
