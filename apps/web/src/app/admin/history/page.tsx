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
import { getUtcDayRangeForTimeZone } from "@/lib/time/day-range";
import { HistoryFiltersForm } from "./history-filters";
import { Pagination } from "./pagination";
import { SignOutButton } from "../live-register/sign-out-button";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeadCell,
  DataTableHeader,
  DataTableRow,
  DataTableScroll,
  DataTableShell,
} from "@/components/ui/data-table";
import { PageEmptyState, PageLoadingState, PageWarningState } from "@/components/ui/page-state";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";

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

const DEFAULT_COMPANY_TIMEZONE = "Pacific/Auckland";

function getVisitorTypeTone(visitorType: VisitorType): StatusBadgeTone {
  if (visitorType === "CONTRACTOR") return "info";
  if (visitorType === "VISITOR") return "accent";
  if (visitorType === "EMPLOYEE") return "success";
  return "warning";
}

function getLocationStatus(record: {
  location_captured_at: Date | null;
  location_within_radius: boolean | null;
  location_distance_m: number | null;
}): { label: string; tone: string } {
  if (!record.location_captured_at) {
    return { label: "Unavailable", tone: "text-secondary" };
  }

  if (record.location_within_radius === true) {
    return {
      label: `Within radius${record.location_distance_m !== null ? ` (${Math.round(record.location_distance_m)}m)` : ""}`,
      tone: "text-emerald-900 dark:text-emerald-100",
    };
  }

  if (record.location_within_radius === false) {
    return {
      label: `Outside radius${record.location_distance_m !== null ? ` (${Math.round(record.location_distance_m)}m)` : ""}`,
      tone: "text-amber-900 dark:text-amber-100",
    };
  }

  return { label: "Captured", tone: "text-cyan-950 dark:text-cyan-100" };
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
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/history",
    method: "GET",
  });
  const context = await requireAuthenticatedContextReadOnly();
  let historyResult: Awaited<ReturnType<typeof listSignInHistory>> = {
    items: [],
    total: 0,
    page: filters.page,
    pageSize: 20,
    totalPages: 0,
  };
  let sites: Site[] = [];
  let employers: string[] = [];
  let dataLoadFailed = false;

  const historyRequest = listSignInHistory(
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
              from: filters.dateFrom
                ? getUtcDayRangeForTimeZone(
                    filters.dateFrom,
                    DEFAULT_COMPANY_TIMEZONE,
                  ).from
                : undefined,
              to: filters.dateTo
                ? getUtcDayRangeForTimeZone(
                    filters.dateTo,
                    DEFAULT_COMPANY_TIMEZONE,
                  ).to
                : undefined,
            }
          : undefined,
    },
    { page: filters.page, pageSize: 20 },
  );

  try {
    [historyResult, sites, employers] = (await Promise.all([
      historyRequest,
      findAllSites(context.companyId),
      getDistinctEmployers(context.companyId),
    ])) as [Awaited<ReturnType<typeof listSignInHistory>>, Site[], string[]];
  } catch (error) {
    dataLoadFailed = true;
    log.error(
      { company_id: context.companyId, error: String(error) },
      "History records load failed",
    );
    const [sitesResult, employersResult] = await Promise.allSettled([
      findAllSites(context.companyId),
      getDistinctEmployers(context.companyId),
    ]);
    if (sitesResult.status === "fulfilled") {
      sites = sitesResult.value as Site[];
    } else {
      log.error(
        { company_id: context.companyId, error: String(sitesResult.reason) },
        "History sites load failed",
      );
    }
    if (employersResult.status === "fulfilled") {
      employers = employersResult.value;
    } else {
      log.error(
        {
          company_id: context.companyId,
          error: String(employersResult.reason),
        },
        "History employer suggestions load failed",
      );
    }
  }
  const onSiteCount = historyResult.items.filter((record) => !record.sign_out_ts).length;
  const signedOutCount = historyResult.items.filter((record) => Boolean(record.sign_out_ts)).length;
  const locationCapturedCount = historyResult.items.filter(
    (record) => record.location_captured_at !== null,
  ).length;
  const locationCoveragePercent =
    historyResult.items.length > 0
      ? Math.round((locationCapturedCount / historyResult.items.length) * 100)
      : 0;

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Sign-In History
          </h1>
          <p className="mt-1 text-sm text-secondary">
            View and filter site attendance records.
          </p>
        </div>
        <Link
          href="/admin/live-register"
          className="text-sm font-semibold text-accent hover:underline"
        >
          {"<-"} Live Register
        </Link>
      </div>

      <section className="bento-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <div className="bento-card border-indigo-300/35 bg-indigo-500/10">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
            Filtered records
          </p>
          <p className="mt-2 text-3xl font-black text-indigo-950 dark:text-indigo-100">
            {historyResult.total}
          </p>
          <p className="mt-1 text-xs text-secondary">
            Current result set after site, date, and search filters.
          </p>
        </div>
        <div className="bento-card border-emerald-400/35 bg-emerald-500/10">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
            On site
          </p>
          <p className="mt-2 text-3xl font-black text-emerald-900 dark:text-emerald-100">
            {onSiteCount}
          </p>
          <p className="mt-1 text-xs text-secondary">
            People still active inside the filtered window.
          </p>
        </div>
        <div className="bento-card border-cyan-400/35 bg-cyan-500/10">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
            Location proof
          </p>
          <p className="mt-2 text-3xl font-black text-cyan-950 dark:text-cyan-100">
            {locationCoveragePercent}%
          </p>
          <p className="mt-1 text-xs text-secondary">
            {locationCapturedCount} of {historyResult.items.length} visible records include captured location.
          </p>
        </div>
        <Link
          href="/admin/exports"
          className="kinetic-hover bento-card border-amber-400/35 bg-amber-500/10"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
            Audit proof
          </p>
          <p className="mt-2 text-3xl font-black text-amber-900 dark:text-amber-100">
            {signedOutCount}
          </p>
          <p className="mt-1 text-xs text-secondary">
            Signed-out visits in view. Use exports to package evidence for downstream audit requests.
          </p>
        </Link>
      </section>

      {/* Filters */}
      <HistoryFiltersForm
        sites={sites.map((s) => ({ id: s.id, name: s.name }))}
        employers={employers}
      />

      {dataLoadFailed && (
        <PageWarningState
          title="Sign-in history unavailable"
          description="Sign-in history data could not be loaded. Please try again."
          actionHref="/admin/history"
          actionLabel="Retry"
        />
      )}

      {/* Results */}
      {historyResult.items.length === 0 ? (
        <PageEmptyState
          title="No records found"
          description="Try adjusting your filters to find what you are looking for."
        />
      ) : (
        <>
          <DataTableShell className="mb-4">
            <DataTableScroll>
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHeadCell className="px-6">
                      Visitor
                    </DataTableHeadCell>
                    <DataTableHeadCell className="px-6">
                      Site
                    </DataTableHeadCell>
                    <DataTableHeadCell className="px-6">
                      Type
                    </DataTableHeadCell>
                    <DataTableHeadCell className="px-6">
                      Employer
                    </DataTableHeadCell>
                    <DataTableHeadCell className="px-6">
                      Sign In
                    </DataTableHeadCell>
                    <DataTableHeadCell className="px-6">
                      Sign Out
                    </DataTableHeadCell>
                    <DataTableHeadCell className="px-6">
                      Duration
                    </DataTableHeadCell>
                    <DataTableHeadCell className="px-6">
                      Location
                    </DataTableHeadCell>
                    <DataTableHeadCell className="px-6 text-right">
                      Actions
                    </DataTableHeadCell>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {historyResult.items.map((record) => {
                    const isOnSite = !record.sign_out_ts;
                    const locationStatus = getLocationStatus(record);

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
                      <DataTableRow key={record.id}>
                        <DataTableCell className="px-6 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-surface-soft bg-[color:var(--bg-surface)]">
                              <span className="text-sm font-semibold text-secondary">
                                {record.visitor_name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </span>
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-semibold text-[color:var(--text-primary)]">
                                {record.visitor_name}
                              </div>
                              <div className="text-xs text-muted">
                                {record.visitor_phone || "Unavailable"}
                              </div>
                            </div>
                          </div>
                        </DataTableCell>
                        <DataTableCell className="px-6 whitespace-nowrap text-[color:var(--text-primary)]">
                          {record.site.name}
                        </DataTableCell>
                        <DataTableCell className="px-6 whitespace-nowrap">
                          <StatusBadge tone={getVisitorTypeTone(record.visitor_type)}>
                            {record.visitor_type.toLowerCase()}
                          </StatusBadge>
                        </DataTableCell>
                        <DataTableCell className="px-6 whitespace-nowrap">
                          {record.employer_name || "-"}
                        </DataTableCell>
                        <DataTableCell className="px-6 whitespace-nowrap">
                          <div>
                            {record.sign_in_ts.toLocaleDateString("en-NZ")}
                          </div>
                          <div className="text-sm text-muted">
                            {record.sign_in_ts.toLocaleTimeString("en-NZ", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </DataTableCell>
                        <DataTableCell className="px-6 whitespace-nowrap">
                          {isOnSite ? (
                            <StatusBadge tone="success">
                              On Site
                            </StatusBadge>
                          ) : (
                            <div className="text-secondary">
                              <div>
                                {record.sign_out_ts!.toLocaleDateString(
                                  "en-NZ",
                                )}
                              </div>
                              <div className="text-sm text-muted">
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
                        </DataTableCell>
                        <DataTableCell className="px-6 whitespace-nowrap">
                          {durationStr}
                        </DataTableCell>
                        <DataTableCell className="px-6 whitespace-nowrap">
                          <span className={locationStatus.tone}>
                            {locationStatus.label}
                          </span>
                        </DataTableCell>
                        <DataTableCell className="px-6 whitespace-nowrap text-right">
                          {isOnSite && (
                            <SignOutButton
                              signInId={record.id}
                              visitorName={record.visitor_name}
                            />
                          )}
                        </DataTableCell>
                      </DataTableRow>
                    );
                  })}
                </DataTableBody>
              </DataTable>
            </DataTableScroll>
          </DataTableShell>

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
        <PageLoadingState
          title="Loading sign-in history"
          description="Gathering attendance records and filter options."
        />
      }
    >
      <HistoryContent filters={filters} />
    </Suspense>
  );
}

