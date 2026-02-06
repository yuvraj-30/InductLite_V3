/**
 * Sites List Page
 *
 * Displays all sites for the current tenant with management actions.
 */

import Link from "next/link";
import { checkAuthReadOnly, checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import { findAllSites, findSitesByIds } from "@/lib/repository";
import { listManagedSiteIds } from "@/lib/repository/site-manager.repository";
import { listActivePublicLinksForSites } from "@/lib/repository/site.repository";
import { DeactivateSiteButton, ReactivateSiteButton } from "./site-buttons";

export const metadata = {
  title: "Sites | InductLite",
};

export default async function SitesPage() {
  // Check authentication (all authenticated users can view sites)
  const guard = await checkAuthReadOnly();
  if (!guard.success) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">{guard.error}</p>
        </div>
      </div>
    );
  }

  // Get tenant context
  const context = await requireAuthenticatedContextReadOnly();

  // Fetch sites for this company (site managers only see assigned sites)
  let sites = [] as Awaited<ReturnType<typeof findAllSites>>;
  if (guard.user.role === "SITE_MANAGER") {
    const managedIds = await listManagedSiteIds(
      context.companyId,
      guard.user.id,
    );
    sites = await findSitesByIds(context.companyId, managedIds);
  } else {
    sites = await findAllSites(context.companyId);
  }

  // Get active public links for each site
  const sitePublicLinks = await listActivePublicLinksForSites(
    context.companyId,
    sites.map((s) => s.id),
  );

  const linksBySiteId = new Map(
    sitePublicLinks.map((l) => [l.site_id, l.slug]),
  );

  // Check if user can manage sites
  const canManage = await checkPermissionReadOnly("site:manage");
  const canManageSites = canManage.success;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sites</h1>
          <p className="text-gray-600 mt-1">
            Manage your construction sites and their sign-in links
          </p>
        </div>

        {canManageSites && (
          <Link
            href="/admin/sites/new"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
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
          <h3 className="mt-2 text-sm font-medium text-gray-900">No sites</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new site.
          </p>
          {canManageSites && (
            <div className="mt-6">
              <Link
                href="/admin/sites/new"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
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
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {sites.map((site) => {
              const publicSlug = linksBySiteId.get(site.id);

              return (
                <li key={site.id}>
                  <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center">
                          <Link
                            href={`/admin/sites/${site.id}`}
                            className="text-lg font-medium text-blue-600 hover:text-blue-800 truncate"
                          >
                            {site.name}
                          </Link>
                          <span
                            className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              site.is_active
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {site.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        {site.address && (
                          <p className="mt-1 text-sm text-gray-500 truncate">
                            {site.address}
                          </p>
                        )}
                        {site.description && (
                          <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                            {site.description}
                          </p>
                        )}
                        {publicSlug && (
                          <p className="mt-2 text-xs text-gray-400">
                            Public link: /s/{publicSlug.substring(0, 8)}...
                          </p>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <Link
                          href={`/admin/sites/${site.id}`}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          View
                        </Link>

                        {canManageSites && site.is_active && (
                          <DeactivateSiteButton
                            siteId={site.id}
                            siteName={site.name}
                          />
                        )}

                        {canManageSites && !site.is_active && (
                          <ReactivateSiteButton
                            siteId={site.id}
                            siteName={site.name}
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

      <div className="mt-4 text-sm text-gray-500">
        Showing {sites.length} site{sites.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
