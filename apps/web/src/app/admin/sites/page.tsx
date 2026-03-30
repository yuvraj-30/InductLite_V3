/**
 * Sites List Page
 *
 * Displays all sites for the current tenant with management actions.
 */

import Link from "next/link";
import { checkAuthReadOnly, checkPermissionReadOnly } from "@/lib/auth";
import { findSitesByIds, listSites } from "@/lib/repository";
import { listManagedSiteIds } from "@/lib/repository/site-manager.repository";
import { listActivePublicLinksForSites } from "@/lib/repository/site.repository";
import { getOnboardingProgress } from "@/lib/repository/dashboard.repository";
import { PageEmptyState } from "@/components/ui/page-state";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { OnboardingChecklist } from "../components/OnboardingChecklist";
import {
  DeactivateSiteButton,
  ReactivateSiteButton,
} from "./site-buttons";

export const metadata = {
  title: "Sites | InductLite",
};

const PAGE_SIZE = 20;
const STATUS_FILTERS = [
  { value: "all", label: "All Sites" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

type SitePageRow = Awaited<ReturnType<typeof findSitesByIds>>[number];
export type SiteStatusFilter = (typeof STATUS_FILTERS)[number]["value"];

interface SitesPageProps {
  searchParams?: Promise<{
    page?: string;
    q?: string;
    status?: string;
  }>;
}

interface PageHrefOptions {
  query?: string;
  status?: SiteStatusFilter;
}

export function parsePositiveInt(input: string | undefined, fallback: number): number {
  if (!input) return fallback;
  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

export function normalizeSiteSearchQuery(input: string | undefined): string {
  return (input ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
}

export function parseSiteStatusFilter(input: string | undefined): SiteStatusFilter {
  if (input === "active" || input === "inactive") return input;
  return "all";
}

export function siteMatchesFilters(
  site: { name: string; is_active: boolean },
  query: string,
  status: SiteStatusFilter,
): boolean {
  const normalizedName = site.name.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const matchesQuery =
    normalizedQuery.length === 0 || normalizedName.includes(normalizedQuery);
  const matchesStatus =
    status === "all" ||
    (status === "active" ? site.is_active : !site.is_active);

  return matchesQuery && matchesStatus;
}

function clampPage(page: number, totalPages: number): number {
  if (totalPages < 1) return 1;
  return Math.min(Math.max(page, 1), totalPages);
}

export function buildPageHref(page: number, options: PageHrefOptions = {}) {
  const params = new URLSearchParams();
  const query = normalizeSiteSearchQuery(options.query);
  if (page > 1) {
    params.set("page", String(page));
  }
  if (query) {
    params.set("q", query);
  }
  if (options.status && options.status !== "all") {
    params.set("status", options.status);
  }

  const queryString = params.toString();
  return queryString ? `/admin/sites?${queryString}` : "/admin/sites";
}

function SiteIdentity({
  site,
  siteHref,
  comfortable = false,
}: {
  site: SitePageRow;
  siteHref: string;
  comfortable?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href={siteHref}
          className={`min-w-0 truncate font-semibold text-[color:var(--text-primary)] hover:text-[color:var(--accent-primary)] hover:underline ${
            comfortable ? "text-base" : "text-sm"
          }`}
        >
          {site.name}
        </Link>
      </div>
      {site.description ? (
        <p
          className={`mt-1 line-clamp-2 text-secondary ${
            comfortable ? "text-sm" : "text-xs"
          }`}
        >
          {site.description}
        </p>
      ) : (
        <p
          className={`mt-1 text-muted ${
            comfortable ? "text-sm" : "text-xs"
          }`}
        >
          No site description recorded.
        </p>
      )}
    </div>
  );
}

function SiteAddress({
  address,
  comfortable = false,
}: {
  address?: string | null;
  comfortable?: boolean;
}) {
  if (!address) {
    return (
      <p className={comfortable ? "text-sm text-muted" : "text-xs text-muted"}>
        No address recorded
      </p>
    );
  }

  return (
    <p
      className={`text-[color:var(--text-primary)] ${
        comfortable ? "text-sm" : "text-xs"
      }`}
    >
      {address}
    </p>
  );
}

function SitePublicLink({
  publicSlug,
  comfortable = false,
}: {
  publicSlug?: string;
  comfortable?: boolean;
}) {
  if (!publicSlug) {
    return (
      <div className="space-y-1">
        <p
          className={`font-medium text-[color:var(--text-primary)] ${
            comfortable ? "text-sm" : "text-xs"
          }`}
        >
          Not published
        </p>
        <p
          className={`text-muted ${
            comfortable ? "text-sm" : "text-xs"
          }`}
        >
          No active public sign-in link.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p
        className={`font-medium text-[color:var(--text-primary)] ${
          comfortable ? "text-sm" : "text-xs"
        }`}
      >
        Live sign-in
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/s/${publicSlug}`}
          target="_blank"
          rel="noreferrer"
          className={`max-w-full truncate font-mono text-[color:var(--accent-primary)] hover:underline ${
            comfortable ? "text-sm" : "text-xs"
          }`}
        >
          /s/{publicSlug}
        </a>
        <span className="rounded-full border border-[color:var(--border-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-secondary">
          Open
        </span>
      </div>
    </div>
  );
}

function SiteState({ isActive }: { isActive: boolean }) {
  return (
    <div className="space-y-1">
      <StatusBadge tone={isActive ? "success" : "neutral"}>
        {isActive ? "Active" : "Inactive"}
      </StatusBadge>
      <p className="text-xs text-muted">
        {isActive ? "Accepting new sign-ins" : "Hidden from new sign-ins"}
      </p>
    </div>
  );
}

function SiteRowActions({
  site,
  canManageSites,
  compact = false,
}: {
  site: SitePageRow;
  canManageSites: boolean;
  compact?: boolean;
}) {
  const siteHref = `/admin/sites/${site.id}`;
  const viewClassName = compact
    ? "btn-secondary min-h-[34px] rounded-md px-2.5 py-1.5 text-xs font-medium"
    : "btn-secondary min-h-[40px] justify-center rounded-lg px-3 py-2 text-sm font-medium";
  const containerClassName = compact
    ? "flex flex-wrap items-center justify-end gap-2"
    : "grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center";

  return (
    <div className={containerClassName}>
      <Link href={siteHref} className={viewClassName}>
        View
      </Link>

      {canManageSites && site.is_active ? (
        <DeactivateSiteButton
          siteId={site.id}
          siteName={site.name}
          compact={compact}
        />
      ) : null}

      {canManageSites && !site.is_active ? (
        <ReactivateSiteButton
          siteId={site.id}
          siteName={site.name}
          compact={compact}
        />
      ) : null}
    </div>
  );
}

export default async function SitesPage({ searchParams }: SitesPageProps) {
  const guard = await checkAuthReadOnly();
  if (!guard.success) {
    return (
      <div className="space-y-5 p-3 sm:p-4">
        <div className="table-toolbar">
          <div className="table-toolbar-heading">
            <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
              Sites
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Manage your construction sites and their sign-in links
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-red-400/45 bg-red-100/70 p-4 dark:bg-red-950/45">
          <h2 className="text-sm font-semibold text-red-950 dark:text-red-100">
            Access unavailable
          </h2>
          <p className="mt-1 text-sm text-red-900 dark:text-red-200">
            {guard.error}
          </p>
        </div>
      </div>
    );
  }

  const companyId = guard.user.companyId;
  const canManagePromise = checkPermissionReadOnly("site:manage");
  const params = (await searchParams) ?? {};
  const requestedPage = parsePositiveInt(params.page, 1);
  const searchQuery = normalizeSiteSearchQuery(params.q);
  const statusFilter = parseSiteStatusFilter(params.status);
  const hasActiveFilters =
    searchQuery.length > 0 || statusFilter !== "all";

  let currentPage = requestedPage;
  let totalSites = 0;
  let totalPages = 1;
  let sites: SitePageRow[] = [];

  if (guard.user.role === "SITE_MANAGER") {
    const managedIds = await listManagedSiteIds(companyId, guard.user.id);
    const allManagedSites = await findSitesByIds(companyId, managedIds);
    const filteredManagedSites = allManagedSites.filter((site) =>
      siteMatchesFilters(site, searchQuery, statusFilter),
    );
    totalSites = filteredManagedSites.length;
    totalPages = Math.max(1, Math.ceil(totalSites / PAGE_SIZE));
    currentPage = clampPage(requestedPage, totalPages);
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    sites = filteredManagedSites.slice(startIndex, startIndex + PAGE_SIZE);
  } else {
    const result = await listSites(
      companyId,
      {
        ...(searchQuery ? { name: searchQuery } : {}),
        ...(statusFilter !== "all"
          ? { isActive: statusFilter === "active" }
          : {}),
      },
      {
        page: requestedPage,
        pageSize: PAGE_SIZE,
      },
    );
    sites = result.items;
    totalSites = result.total;
    totalPages = result.totalPages;
    currentPage = clampPage(result.page, result.totalPages);
  }

  const sitePublicLinks = await listActivePublicLinksForSites(
    companyId,
    sites.map((site) => site.id),
  );
  const linksBySiteId = new Map(
    sitePublicLinks.map((link) => [link.site_id, link.slug]),
  );

  const canManageSites = (await canManagePromise).success;
  let emptyStateData:
    | {
        canManageTemplates: boolean;
        onboardingProgress: Awaited<ReturnType<typeof getOnboardingProgress>>;
      }
    | null = null;

  const showOnboardingEmptyState = sites.length === 0 && !hasActiveFilters;
  const showFilteredEmptyState = sites.length === 0 && hasActiveFilters;

  if (showOnboardingEmptyState) {
    const [canManageTemplatesPermission, onboardingProgress] =
      await Promise.all([
        checkPermissionReadOnly("template:manage"),
        getOnboardingProgress(companyId),
      ]);
    emptyStateData = {
      canManageTemplates: canManageTemplatesPermission.success,
      onboardingProgress,
    };
  }

  const visibleStart = totalSites === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const visibleEnd =
    totalSites === 0 ? 0 : visibleStart + Math.max(sites.length - 1, 0);
  const showingLabel = `Showing ${sites.length} of ${totalSites} site${
    totalSites === 1 ? "" : "s"
  }`;

  return (
    <div className="space-y-5 p-3 sm:p-4">
      <section className="table-toolbar">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
                Sites
              </h1>
              <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">
                Operator View
              </span>
            </div>
            <p className="mt-1 text-sm text-secondary">
              Manage site status, public sign-in links, and row-level actions
              from one scan-friendly workspace.
            </p>
          </div>

          {canManageSites ? (
            <Link
              href="/admin/sites/new"
              className="btn-primary w-full sm:w-auto"
            >
              <svg
                className="-ml-1 mr-2 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Site
            </Link>
          ) : null}
        </div>

        <div className="table-toolbar-footer">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <form
              method="get"
              role="search"
              className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
            >
              <div className="w-full sm:max-w-sm">
                <label
                  htmlFor="sites-search"
                  className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
                >
                  Search Site Name
                </label>
                <input
                  id="sites-search"
                  name="q"
                  defaultValue={searchQuery}
                  autoComplete="off"
                  placeholder="Search by site name"
                  className="input min-h-[42px]"
                />
              </div>

              <div className="table-toolbar-actions">
                <button type="submit" className="btn-primary min-h-[42px] px-4">
                  Apply
                </button>
                {hasActiveFilters ? (
                  <Link
                    href="/admin/sites"
                    className="btn-secondary min-h-[42px] px-4"
                  >
                    Clear
                  </Link>
                ) : null}
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              {STATUS_FILTERS.map((filterOption) => {
                const isActive = filterOption.value === statusFilter;
                return (
                  <Link
                    key={filterOption.value}
                    href={buildPageHref(1, {
                      query: searchQuery,
                      status: filterOption.value,
                    })}
                    aria-current={isActive ? "page" : undefined}
                    className={`inline-flex min-h-[38px] items-center rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] ${
                      isActive
                        ? "border-[color:var(--accent-primary)] bg-[color:var(--accent-primary)] text-white"
                        : "border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] text-secondary hover:bg-[color:var(--bg-surface-strong)]"
                    }`}
                  >
                    {filterOption.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border-soft)] pt-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                {showingLabel}
              </p>
              <p className="text-xs text-secondary">
                {sites.length > 0
                  ? `Rows ${visibleStart}-${visibleEnd}${hasActiveFilters ? " filtered" : ""}`
                  : hasActiveFilters
                    ? "No sites matched the current filters."
                    : "No sites have been created yet."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                Page {currentPage} of {totalPages}
              </span>
            </div>
          </div>
        </div>
      </section>

      {showOnboardingEmptyState ? (
        <PageEmptyState
          title="No sites"
          description="Get started by creating a new site."
          actionHref={canManageSites ? "/admin/sites/new" : undefined}
          actionLabel={canManageSites ? "Add Site" : undefined}
          icon={
            <svg
              className="mx-auto h-12 w-12 text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          }
        >
          <OnboardingChecklist
            progress={emptyStateData!.onboardingProgress}
            className="text-left"
            canManageSites={canManageSites}
            canManageTemplates={emptyStateData!.canManageTemplates}
          />
        </PageEmptyState>
      ) : showFilteredEmptyState ? (
        <div className="surface-panel p-6 text-center">
          <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
            No sites match the current filters
          </h2>
          <p className="mt-2 text-sm text-secondary">
            Try a different site name or reset the status filter to widen the
            results.
          </p>
          <div className="mt-4 flex justify-center">
            <Link href="/admin/sites" className="btn-secondary px-4 py-2">
              Clear filters
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="progressive-disclosure-mobile space-y-3">
            {sites.map((site) => {
              const siteHref = `/admin/sites/${site.id}`;
              const publicSlug = linksBySiteId.get(site.id);

              return (
                <article
                  key={`mobile-${site.id}`}
                  className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4 shadow-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <SiteIdentity
                      site={site}
                      siteHref={siteHref}
                      comfortable
                    />
                    <StatusBadge tone={site.is_active ? "success" : "neutral"}>
                      {site.is_active ? "Active" : "Inactive"}
                    </StatusBadge>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                        Address
                      </p>
                      <div className="mt-1">
                        <SiteAddress
                          address={site.address}
                          comfortable
                        />
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                        Public Sign-In
                      </p>
                      <div className="mt-1">
                        <SitePublicLink
                          publicSlug={publicSlug}
                          comfortable
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <SiteRowActions
                      site={site}
                      canManageSites={canManageSites}
                    />
                  </div>
                </article>
              );
            })}
          </div>

          <div className="progressive-disclosure-desktop">
            <DataTableShell>
              <DataTableScroll className="data-table-scroll-sticky-frame">
                <DataTable className="data-table-compact data-table-sticky-head">
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHeadCell className="w-[28%] min-w-[18rem]">
                        Site
                      </DataTableHeadCell>
                      <DataTableHeadCell className="w-[23%] min-w-[14rem]">
                        Address
                      </DataTableHeadCell>
                      <DataTableHeadCell className="w-[21%] min-w-[14rem]">
                        Public Sign-In
                      </DataTableHeadCell>
                      <DataTableHeadCell className="w-[14%] min-w-[10rem]">
                        Status
                      </DataTableHeadCell>
                      <DataTableHeadCell className="w-[14%] min-w-[14rem] text-right">
                        Actions
                      </DataTableHeadCell>
                    </DataTableRow>
                  </DataTableHeader>

                  <DataTableBody>
                    {sites.map((site) => {
                      const siteHref = `/admin/sites/${site.id}`;
                      const publicSlug = linksBySiteId.get(site.id);

                      return (
                        <DataTableRow key={site.id}>
                          <DataTableCell className="min-w-[18rem]">
                            <SiteIdentity site={site} siteHref={siteHref} />
                          </DataTableCell>
                          <DataTableCell>
                            <SiteAddress address={site.address} />
                          </DataTableCell>
                          <DataTableCell>
                            <SitePublicLink publicSlug={publicSlug} />
                          </DataTableCell>
                          <DataTableCell>
                            <SiteState isActive={site.is_active} />
                          </DataTableCell>
                          <DataTableCell className="align-middle">
                            <SiteRowActions
                              site={site}
                              canManageSites={canManageSites}
                              compact
                            />
                          </DataTableCell>
                        </DataTableRow>
                      );
                    })}
                  </DataTableBody>
                </DataTable>
              </DataTableScroll>
            </DataTableShell>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-4 py-3 shadow-soft">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--text-primary)]">
            {showingLabel}
          </p>
          <p className="text-xs text-secondary">
            {sites.length > 0
              ? `Rows ${visibleStart}-${visibleEnd}`
              : hasActiveFilters
                ? "No rows match the current filters."
                : "No rows yet."}
          </p>
        </div>

        {totalPages > 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-secondary">
              Page {currentPage} of {totalPages}
            </span>
            <Link
              href={buildPageHref(Math.max(currentPage - 1, 1), {
                query: searchQuery,
                status: statusFilter,
              })}
              aria-disabled={currentPage === 1}
              className={`btn-secondary min-h-[38px] px-3 py-1.5 text-sm ${
                currentPage === 1
                  ? "pointer-events-none cursor-not-allowed opacity-50"
                  : ""
              }`}
            >
              Previous
            </Link>
            <Link
              href={buildPageHref(Math.min(currentPage + 1, totalPages), {
                query: searchQuery,
                status: statusFilter,
              })}
              aria-disabled={currentPage === totalPages}
              className={`btn-secondary min-h-[38px] px-3 py-1.5 text-sm ${
                currentPage === totalPages
                  ? "pointer-events-none cursor-not-allowed opacity-50"
                  : ""
              }`}
            >
              Next
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
