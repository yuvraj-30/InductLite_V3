/**
 * Site Detail Page
 *
 * View and edit a specific site with QR code management.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { checkAuthReadOnly, checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { findSiteById } from "@/lib/repository";
import { isUserSiteManagerForSite } from "@/lib/repository/site-manager.repository";
import { findActivePublicLinkForSite } from "@/lib/repository/site.repository";
import {
  countCurrentlyOnSite,
  listRecentSignInsForSite,
} from "@/lib/repository/signin.repository";
import { EditSiteForm } from "./edit-site-form";
import { RotateLinkButton } from "../site-buttons";
import { CopyLinkButton } from "./CopyLinkButton";

export const metadata = {
  title: "Site Details | InductLite",
};

interface SiteDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SiteDetailPage({ params }: SiteDetailPageProps) {
  const { id: siteId } = await params;

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

  if (guard.user.role === "SITE_MANAGER") {
    const allowed = await isUserSiteManagerForSite(
      context.companyId,
      guard.user.id,
      siteId,
    );
    if (!allowed) {
      notFound();
    }
  }

  // Fetch the site
  const site = await findSiteById(context.companyId, siteId);
  if (!site) {
    notFound();
  }

  // Fetch active public link
  const publicLink = await findActivePublicLinkForSite(
    context.companyId,
    siteId,
  );

  // Fetch recent sign-ins for this site
  const recentSignIns = await listRecentSignInsForSite(
    context.companyId,
    siteId,
    10,
  );

  // Get currently on-site count
  const currentlyOnSite = await countCurrentlyOnSite(context.companyId, siteId);

  // Check if user can manage sites
  const canManage = await checkPermissionReadOnly("site:manage");
  const canManageSites = canManage.success;

  // Build the public sign-in URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const publicUrl = publicLink ? `${baseUrl}/s/${publicLink.slug}` : null;

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="mb-6">
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            <li>
              <Link
                href="/admin/sites"
                className="text-gray-500 hover:text-gray-700"
              >
                Sites
              </Link>
            </li>
            <li>
              <svg
                className="flex-shrink-0 h-5 w-5 text-gray-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </li>
            <li>
              <span className="text-gray-900 font-medium">{site.name}</span>
            </li>
          </ol>
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Site Header */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {site.name}
                </h1>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    site.is_active
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {site.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            {site.address && (
              <p className="text-gray-600 mb-2">
                <span className="font-medium">Address:</span> {site.address}
              </p>
            )}
            {site.description && (
              <p className="text-gray-600">
                <span className="font-medium">Description:</span>{" "}
                {site.description}
              </p>
            )}
            <p className="text-sm text-gray-400 mt-4">
              Created: {new Date(site.created_at).toLocaleDateString()}
            </p>
          </div>

          {/* Edit Form (if permitted) */}
          {canManageSites && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Edit Site
              </h2>
              <EditSiteForm site={site} />
            </div>
          )}

          {/* Recent Sign-Ins */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Recent Sign-Ins
            </h2>
            {recentSignIns.length === 0 ? (
              <p className="text-gray-500 text-sm">No sign-ins recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Visitor
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Employer
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Signed In
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Signed Out
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {recentSignIns.map((record) => (
                      <tr key={record.id}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {record.visitor_name}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                          {record.employer_name || "-"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                          {new Date(record.sign_in_ts).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                          {record.sign_out_ts ? (
                            new Date(record.sign_out_ts).toLocaleString()
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              On site
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* QR Code / Public Link */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Public Sign-In Link
            </h2>

            {publicUrl ? (
              <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-xs text-gray-500 mb-1">Public URL:</p>
                  <p className="text-sm font-mono text-gray-800 break-all">
                    {publicUrl}
                  </p>
                </div>

                <div className="flex flex-col space-y-2">
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <svg
                      className="-ml-0.5 mr-1.5 h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    Open Link
                  </a>

                  <CopyLinkButton url={publicUrl} />
                </div>

                {canManageSites && (
                  <div className="pt-4 border-t">
                    <p className="text-xs text-gray-500 mb-2">
                      Rotate to invalidate the current link and generate a new
                      one:
                    </p>
                    <RotateLinkButton siteId={siteId} />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                No active public link for this site.
              </p>
            )}
          </div>

          {/* Site Stats */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Quick Stats
            </h2>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Currently On-Site
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-blue-600">
                  {currentlyOnSite}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Recent Sign-Ins
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  {recentSignIns.length}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
