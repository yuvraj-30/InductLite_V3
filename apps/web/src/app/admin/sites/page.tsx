/**
 * Sites List Page
 *
 * Displays all sites for the current tenant with management actions.
 */

import Link from "next/link";
import dynamic from "next/dynamic";
import { checkAuthReadOnly, checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { findAllSites, findSitesByIds } from "@/lib/repository";
import { listManagedSiteIds } from "@/lib/repository/site-manager.repository";
import { listActivePublicLinksForSites } from "@/lib/repository/site.repository";
import { getOnboardingProgress } from "@/lib/repository/dashboard.repository";
import { OnboardingChecklist } from "../components/OnboardingChecklist";
import { statusChipClass } from "../components/status-chip";
import { PageEmptyState } from "@/components/ui/page-state";

const DeactivateSiteButton = dynamic(
  () =>
    import("./site-buttons").then((mod) => ({
      default: mod.DeactivateSiteButton,
    })),
);

const ReactivateSiteButton = dynamic(
  () =>
    import("./site-buttons").then((mod) => ({
      default: mod.ReactivateSiteButton,
    })),
);

export const metadata = {
  title: "Sites | InductLite",
};

export default async function SitesPage() {
  // Check authentication (all authenticated users can view sites)
  const guard = await checkAuthReadOnly();
  if (!guard.success) {
    return (
      <div className="space-y-6 p-3 sm:p-4">
        <div className="surface-panel-strong p-5">
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Sites
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Manage your construction sites and their sign-in links
          </p>
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
  const [canManage, canManageTemplatesPermission, onboardingProgress] =
    await Promise.all([
      checkPermissionReadOnly("site:manage"),
      checkPermissionReadOnly("template:manage"),
      getOnboardingProgress(companyId),
    ]);

  // Fetch sites for this company (site managers only see assigned sites)
  let sites = [] as Awaited<ReturnType<typeof findAllSites>>;
  if (guard.user.role === "SITE_MANAGER") {
    const managedIds = await listManagedSiteIds(
      companyId,
      guard.user.id,
    );
    sites = await findSitesByIds(companyId, managedIds);
  } else {
    sites = await findAllSites(companyId);
  }

  // Get active public links for each site
  const sitePublicLinks = await listActivePublicLinksForSites(
    companyId,
    sites.map((s) => s.id),
  );

  const linksBySiteId = new Map(
    sitePublicLinks.map((l) => [l.site_id, l.slug]),
  );

  // Check if user can manage sites/templates
  const canManageSites = canManage.success;
  const canManageTemplates = canManageTemplatesPermission.success;
  const mobileShellEnabled = isFeatureEnabled("UIX_S3_MOBILE");

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Sites
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Manage your construction sites and their sign-in links
          </p>
        </div>

        {canManageSites && (
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
        )}
      </div>

      {sites.length === 0 ? (
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
            progress={onboardingProgress}
            className="text-left"
            canManageSites={canManageSites}
            canManageTemplates={canManageTemplates}
          />
        </PageEmptyState>
      ) : (
        <div className="surface-panel overflow-hidden">
          <ul className="divide-y divide-[color:var(--border-soft)]">
            {sites.map((site) => {
              const publicSlug = linksBySiteId.get(site.id);

              return (
                <li key={site.id}>
                  <div className="px-4 py-4 sm:px-6 hover:bg-[color:var(--bg-surface-strong)]">
                    {mobileShellEnabled ? (
                      <div className="space-y-3 md:hidden">
                        <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <Link
                              href={`/admin/sites/${site.id}`}
                              className="min-w-0 flex-1 truncate text-base font-semibold text-[color:var(--accent-cyber)] hover:underline"
                            >
                              {site.name}
                            </Link>
                            <span
                              className={statusChipClass(
                                site.is_active ? "success" : "neutral",
                                "items-center",
                              )}
                            >
                              {site.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                          {site.address ? (
                            <p className="mt-2 text-sm text-secondary">{site.address}</p>
                          ) : null}
                          {site.description ? (
                            <p className="mt-1 line-clamp-2 text-sm text-secondary">
                              {site.description}
                            </p>
                          ) : null}
                          {publicSlug ? (
                            <p className="mt-2 text-xs text-muted">
                              Public link: /s/{publicSlug.substring(0, 8)}...
                            </p>
                          ) : null}
                        </div>

                        <div
                          className={`grid gap-2 ${canManageSites ? "grid-cols-2" : "grid-cols-1"}`}
                        >
                          <Link
                            href={`/admin/sites/${site.id}`}
                            className="btn-secondary min-h-[44px] justify-center px-3 py-2 text-sm"
                          >
                            View
                          </Link>
                          {canManageSites && site.is_active ? (
                            <DeactivateSiteButton
                              siteId={site.id}
                              siteName={site.name}
                              className="w-full justify-center min-h-[44px]"
                            />
                          ) : null}
                          {canManageSites && !site.is_active ? (
                            <ReactivateSiteButton
                              siteId={site.id}
                              siteName={site.name}
                              className="w-full justify-center min-h-[44px]"
                            />
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <div
                      className={`flex flex-col gap-4 md:flex-row md:items-center md:justify-between ${mobileShellEnabled ? "hidden md:flex" : ""}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center">
                          <Link
                            href={`/admin/sites/${site.id}`}
                            className="truncate text-lg font-semibold text-[color:var(--accent-cyber)] hover:underline"
                          >
                            {site.name}
                          </Link>
                          <span
                            className={`ml-2 ${statusChipClass(site.is_active ? "success" : "neutral", "items-center")}`}
                          >
                            {site.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        {site.address && (
                          <p className="mt-1 truncate text-sm text-secondary">
                            {site.address}
                          </p>
                        )}
                        {site.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-secondary">
                            {site.description}
                          </p>
                        )}
                        {publicSlug && (
                          <p className="mt-2 text-xs text-muted">
                            Public link: /s/{publicSlug.substring(0, 8)}...
                          </p>
                        )}
                      </div>

                      <div className="ml-0 flex items-center gap-2 md:ml-4">
                        <Link
                          href={`/admin/sites/${site.id}`}
                          className="btn-secondary min-h-[38px] px-3 py-1.5 text-xs"
                        >
                          View
                        </Link>

                        {canManageSites && site.is_active && (
                          <DeactivateSiteButton
                            siteId={site.id}
                            siteName={site.name}
                            className="min-h-[38px]"
                          />
                        )}

                        {canManageSites && !site.is_active && (
                          <ReactivateSiteButton
                            siteId={site.id}
                            siteName={site.name}
                            className="min-h-[38px]"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="text-sm text-secondary">
        Showing {sites.length} site{sites.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
