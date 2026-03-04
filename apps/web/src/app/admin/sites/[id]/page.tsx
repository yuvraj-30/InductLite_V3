/**
 * Site Detail Page
 *
 * View and edit a specific site with QR code management.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { checkAuthReadOnly, checkPermissionReadOnly } from "@/lib/auth";
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
import { QRCodeButton } from "./QRCodeButton";
import { headers } from "next/headers";
import { getPublicBaseUrl } from "@/lib/url/public-url";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";

export const metadata = {
  title: "Site Details | InductLite",
};

interface SiteDetailPageProps {
  params: Promise<{ id: string }>;
}

const NZ_TIMEZONE = "Pacific/Auckland";

function formatNzDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("en-NZ", {
    timeZone: NZ_TIMEZONE,
  });
}

function formatNzDateTime(value: Date | string): string {
  return new Date(value).toLocaleString("en-NZ", {
    timeZone: NZ_TIMEZONE,
  });
}

export default async function SiteDetailPage({ params }: SiteDetailPageProps) {
  const { id: siteId } = await params;
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: `/admin/sites/${siteId}`,
    method: "GET",
  });

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

  const companyId = guard.user.companyId;

  if (guard.user.role === "SITE_MANAGER") {
    const allowed = await isUserSiteManagerForSite(
      companyId,
      guard.user.id,
      siteId,
    );
    if (!allowed) {
      notFound();
    }
  }

  // Fetch the site
  let siteLoadFailed = false;
  let site = await findSiteById(companyId, siteId).catch((error) => {
    siteLoadFailed = true;
    log.error({ company_id: companyId, error: String(error) }, "Site detail load failed");
    return null;
  });
  if (!site) {
    if (siteLoadFailed) {
      return (
        <div className="p-6">
          <div className="mb-4">
            <Link
              href="/admin/sites"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Back to Sites
            </Link>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Site data could not be loaded. Please refresh and try again.
          </div>
        </div>
      );
    }
    notFound();
  }

  let dataLoadFailed = false;
  let publicLink: Awaited<ReturnType<typeof findActivePublicLinkForSite>> =
    null;
  let recentSignIns: Awaited<ReturnType<typeof listRecentSignInsForSite>> = [];
  let currentlyOnSite = 0;
  let canManageSites = false;

  try {
    const [loadedPublicLink, loadedRecentSignIns, loadedCurrentlyOnSite, canManage] =
      await Promise.all([
        findActivePublicLinkForSite(companyId, siteId),
        listRecentSignInsForSite(companyId, siteId, 10),
        countCurrentlyOnSite(companyId, siteId),
        checkPermissionReadOnly("site:manage"),
      ]);

    publicLink = loadedPublicLink;
    recentSignIns = loadedRecentSignIns;
    currentlyOnSite = loadedCurrentlyOnSite;
    canManageSites = canManage.success;
  } catch (error) {
    dataLoadFailed = true;
    log.error({ company_id: companyId, error: String(error) }, "Site detail related data load failed");
    const canManage = await checkPermissionReadOnly("site:manage").catch(() => ({
      success: false,
      error: "Permission check failed",
      code: "FORBIDDEN" as const,
    }));
    canManageSites = canManage.success;
  }

  // Build the public sign-in URL (env URL preferred, request-origin fallback).
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  const requestOrigin = host
    ? `${proto.split(",")[0]!.trim()}://${host.split(",")[0]!.trim()}`
    : undefined;

  let publicBaseUrl: string | null = null;
  try {
    publicBaseUrl = getPublicBaseUrl(requestOrigin);
  } catch (error) {
    log.error({ error: String(error) }, "Site detail public base URL resolve failed");
  }

  const publicUrl = publicLink
    ? publicBaseUrl
      ? new URL(`/s/${publicLink.slug}`, publicBaseUrl).toString()
      : `/s/${publicLink.slug}`
    : null;

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

      {dataLoadFailed && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Some site details could not be loaded. Please refresh and try again.
        </div>
      )}

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
            {site.location_latitude !== null &&
              site.location_longitude !== null && (
                <p className="text-gray-600 mt-2">
                  <span className="font-medium">Location Audit:</span>{" "}
                  {site.location_latitude.toFixed(6)},{" "}
                  {site.location_longitude.toFixed(6)}
                  {" | "}
                  Radius {site.location_radius_m ?? 150}m
                </p>
              )}
            <p className="text-sm text-gray-400 mt-4">
              Created: {formatNzDate(site.created_at)}
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
                      <th className="px-3 py-2 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                        Visitor
                      </th>
                      <th className="px-3 py-2 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                        Employer
                      </th>
                      <th className="px-3 py-2 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                        Signed In
                      </th>
                      <th className="px-3 py-2 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                        Signed Out
                      </th>
                      <th className="px-3 py-2 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                        Location
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
                          {formatNzDateTime(record.sign_in_ts)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                          {record.sign_out_ts ? (
                            formatNzDateTime(record.sign_out_ts)
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              On site
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm">
                          {!record.location_captured_at ? (
                            <span className="text-gray-500">Unavailable</span>
                          ) : record.location_within_radius === true ? (
                            <span className="text-emerald-700">Within radius</span>
                          ) : record.location_within_radius === false ? (
                            <span className="text-amber-700">Outside radius</span>
                          ) : (
                            <span className="text-cyan-700">Captured</span>
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
                  <QRCodeButton url={publicUrl} siteName={site.name} />
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

          {canManageSites && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-3">
                Emergency Setup
              </h2>
              <p className="text-sm text-gray-600">
                Configure emergency contacts and procedures shown during induction.
              </p>
              <Link
                href={`/admin/sites/${siteId}/emergency`}
                className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Manage Emergency Setup
              </Link>
            </div>
          )}

          {canManageSites && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-3">
                Webhook Integrations
              </h2>
              <p className="text-sm text-gray-600">
                Configure endpoint delivery and signing for
                <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs">
                  induction.completed
                </code>
                events.
              </p>
              <Link
                href={`/admin/sites/${siteId}/webhooks`}
                className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Manage Webhooks
              </Link>
            </div>
          )}

          {canManageSites && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-3">
                LMS Connector
              </h2>
              <p className="text-sm text-gray-600">
                Configure one-way induction completion sync to your LMS endpoint.
              </p>
              <Link
                href={`/admin/sites/${siteId}/lms`}
                className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Manage LMS Connector
              </Link>
            </div>
          )}

          {canManageSites && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-3">
                Access Controls
              </h2>
              <p className="text-sm text-gray-600">
                Configure optional geofence enforcement and hardware gate/turnstile
                decision integrations.
              </p>
              <Link
                href={`/admin/sites/${siteId}/access`}
                className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Manage Access Controls
              </Link>
            </div>
          )}

          {canManageSites && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-3">
                Pre-Registrations
              </h2>
              <p className="text-sm text-gray-600">
                Create invite links with prefilled visitor details before arrival.
              </p>
              <Link
                href={`/admin/pre-registrations?siteId=${siteId}`}
                className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Manage Pre-Registrations
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
