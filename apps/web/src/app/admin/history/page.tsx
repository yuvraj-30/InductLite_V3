/**
 * Sign-In History Page
 *
 * Paginated list of all sign-ins with filters.
 *
 * INDEX USAGE (from prisma/schema.prisma):
 * - @@index([company_id]) - All queries scoped by company
 * - @@index([company_id, site_id]) - Site filter
 * - @@index([company_id, sign_in_ts]) - Date range queries
 * - @@index([company_id, sign_out_ts]) - Status filter (on_site vs signed_out)
 * - @@index([site_id, sign_in_ts]) - Site + date combination
 */

import { Suspense } from "react";
import Link from "next/link";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import {
  listSignInHistory,
  findAllSites,
  getDistinctEmployers,
  type VisitorType,
} from "@/lib/repository";
import { HistoryFiltersForm } from "./history-filters";
import { Pagination } from "./pagination";
import { SignOutButton } from "../live-register/sign-out-button";

export const metadata = {
  title: "Sign-In History | InductLite",
};

interface HistoryPageProps {
  searchParams: Promise<{
    page?: string;
    site?: string;
    status?: string;
    visitorType?: string;
    employer?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }>;
}

interface Site {
  id: string;
  name: string;
  is_active: boolean;
}

async function HistoryContent({
  filters,
}: {
  filters: {
    page: number;
    siteId?: string;
    status?: "on_site" | "signed_out" | "all";
    visitorType?: VisitorType;
    employerName?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  };
}) {
  const context = await requireAuthenticatedContextReadOnly();

  // Fetch data in parallel
  const [historyResult, sites, employers] = (await Promise.all([
    listSignInHistory(
      context.companyId,
      {
        siteId: filters.siteId,
        status: filters.status,
        visitorType: filters.visitorType,
        employerName: filters.employerName,
        search: filters.search,
        dateRange:
          filters.dateFrom || filters.dateTo
            ? {
                from: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
                to: filters.dateTo
                  ? new Date(filters.dateTo + "T23:59:59.999Z")
                  : undefined,
              }
            : undefined,
      },
      { page: filters.page, pageSize: 20 },
    ),
    findAllSites(context.companyId),
    getDistinctEmployers(context.companyId),
  ])) as [Awaited<ReturnType<typeof listSignInHistory>>, Site[], string[]];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sign-In History</h1>
          <p className="text-gray-600 mt-1">
            View and filter all sign-in records
          </p>
        </div>
        <Link
          href="/admin/live-register"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          ← View Live Register
        </Link>
      </div>

      {/* Filters */}
      <HistoryFiltersForm
        sites={sites.map((s) => ({ id: s.id, name: s.name }))}
        employers={employers}
      />

      {/* Results */}
      {historyResult.items.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-gray-400 mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No records found
          </h3>
          <p className="text-gray-600">
            Try adjusting your filters to find what you&apos;re looking for.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Visitor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Site
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sign In
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sign Out
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {historyResult.items.map((record) => {
                    const isOnSite = !record.sign_out_ts;

                    // Avoid calling Date.now() during render (purity rule).
                    // If the visitor is still on-site, we show an explicit status
                    // instead of computing a continuously-changing duration.
                    let durationStr = "On site";
                    if (record.sign_out_ts) {
                      const durationMs =
                        record.sign_out_ts.getTime() -
                        record.sign_in_ts.getTime();
                      const durationMinutes = Math.round(
                        durationMs / (1000 * 60),
                      );
                      const hours = Math.floor(durationMinutes / 60);
                      const minutes = durationMinutes % 60;
                      durationStr =
                        hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                    }

                    return (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                              <span className="text-xs font-medium text-gray-600">
                                {record.visitor_name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </span>
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">
                                {record.visitor_name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {record.visitor_phone}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.site.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              record.visitor_type === "CONTRACTOR"
                                ? "bg-blue-100 text-blue-800"
                                : record.visitor_type === "VISITOR"
                                  ? "bg-purple-100 text-purple-800"
                                  : record.visitor_type === "EMPLOYEE"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {record.visitor_type.toLowerCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.employer_name || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>
                            {record.sign_in_ts.toLocaleDateString("en-NZ")}
                          </div>
                          <div className="text-xs">
                            {record.sign_in_ts.toLocaleTimeString("en-NZ", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {isOnSite ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              On Site
                            </span>
                          ) : (
                            <div className="text-gray-500">
                              <div>
                                {record.sign_out_ts!.toLocaleDateString(
                                  "en-NZ",
                                )}
                              </div>
                              <div className="text-xs">
                                {record.sign_out_ts!.toLocaleTimeString(
                                  "en-NZ",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {durationStr}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {isOnSite && (
                            <SignOutButton
                              signInId={record.id}
                              visitorName={record.visitor_name}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={historyResult.page}
            totalPages={historyResult.totalPages}
            total={historyResult.total}
            pageSize={historyResult.pageSize}
          />
        </>
      )}
    </div>
  );
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams;

  const filters = {
    page: params.page ? parseInt(params.page, 10) : 1,
    siteId: params.site,
    status: params.status as "on_site" | "signed_out" | "all" | undefined,
    visitorType: params.visitorType as VisitorType | undefined,
    employerName: params.employer,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    search: params.search,
  };

  return (
    <Suspense
      fallback={
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-32 mb-8"></div>
            <div className="h-32 bg-gray-200 rounded mb-4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      }
    >
      <HistoryContent filters={filters} />
    </Suspense>
  );
}
