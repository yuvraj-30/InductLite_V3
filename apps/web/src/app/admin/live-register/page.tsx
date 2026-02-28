/**
 * Live Register Page
 *
 * Shows all visitors currently on-site (sign_out_ts is null).
 * Admins can sign out visitors from this page.
 */

import { Suspense } from "react";
import Link from "next/link";
import { checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import {
  listCurrentlyOnSite,
  findAllSites,
  type SignInRecordWithDetails,
} from "@/lib/repository";
import { getOnboardingProgress } from "@/lib/repository/dashboard.repository";
import { SignOutButton } from "./sign-out-button";
import { SiteFilterSelect } from "./SiteFilterSelect";
import { LiveRegisterAutoRefresh } from "./auto-refresh";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import { OnboardingChecklist } from "../components/OnboardingChecklist";

export const metadata = {
  title: "Live Register | InductLite",
};

interface Site {
  id: string;
  name: string;
  is_active: boolean;
}

interface LiveRegisterPageProps {
  searchParams: Promise<{ site?: string }>;
}

function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

async function LiveRegisterContent({
  siteFilter,
}: {
  siteFilter: string | undefined;
}) {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/live-register",
    method: "GET",
  });
  const context = await requireAuthenticatedContextReadOnly();
  const [canManageSitePermission, canManageTemplatePermission, onboardingProgress] =
    await Promise.all([
      checkPermissionReadOnly("site:manage"),
      checkPermissionReadOnly("template:manage"),
      getOnboardingProgress(context.companyId),
    ]);
  const canManageSites = canManageSitePermission.success;
  const canManageTemplates = canManageTemplatePermission.success;
  let records: SignInRecordWithDetails[] = [];
  let sites: Site[] = [];
  let dataLoadFailed = false;

  try {
    [records, sites] = (await Promise.all([
      listCurrentlyOnSite(context.companyId, siteFilter),
      findAllSites(context.companyId),
    ])) as [SignInRecordWithDetails[], Site[]];
  } catch (error) {
    dataLoadFailed = true;
    log.error(
      { company_id: context.companyId, error: String(error) },
      "Live register records load failed",
    );
    try {
      sites = (await findAllSites(context.companyId)) as Site[];
    } catch (siteError) {
      log.error(
        { company_id: context.companyId, error: String(siteError) },
        "Live register sites load failed",
      );
    }
  }

  const groupedBySite = records.reduce<Record<string, SignInRecordWithDetails[]>>(
    (acc, record) => {
      const siteName = record.site.name;
      if (!acc[siteName]) {
        acc[siteName] = [];
      }
      acc[siteName].push(record);
      return acc;
    },
    {},
  );

  const siteNames = Object.keys(groupedBySite).sort();
  const renderedAt = new Date();

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Register</h1>
          <p className="mt-1 text-gray-600">
            {records.length} {records.length === 1 ? "person" : "people"} currently on site
          </p>
        </div>
        <Link href="/admin/history" className="text-sm text-blue-600 hover:text-blue-800">
          View History -&gt;
        </Link>
      </div>

      <div className="mb-4">
        <LiveRegisterAutoRefresh lastUpdatedIso={renderedAt.toISOString()} />
      </div>

      <div className="mb-6">
        <form className="flex items-center gap-4">
          <label htmlFor="site" className="text-sm font-medium text-gray-700">
            Filter by site:
          </label>
          <SiteFilterSelect sites={sites} siteFilter={siteFilter} />
        </form>
      </div>

      {dataLoadFailed && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Live register data could not be loaded. Please try again.
        </div>
      )}

      {records.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center shadow">
          <div className="mb-4 text-gray-400">
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
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
              />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-medium text-gray-900">No one currently on site</h3>
          <p className="text-gray-600">When visitors sign in, they will appear here.</p>
          <OnboardingChecklist
            progress={onboardingProgress}
            className="mt-6 text-left"
            canManageSites={canManageSites}
            canManageTemplates={canManageTemplates}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {siteNames.map((siteName) => {
            const siteRecords = groupedBySite[siteName] ?? [];
            return (
              <div key={siteName} className="rounded-lg bg-white shadow">
                <div className="border-b border-gray-200 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium text-gray-900">{siteName}</h2>
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      {siteRecords.length} on site
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Visitor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Employer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Signed In
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {siteRecords.map((record) => {
                        const durationMinutes = Math.max(
                          0,
                          Math.floor(
                            (renderedAt.getTime() - record.sign_in_ts.getTime()) / (1000 * 60),
                          ),
                        );
                        const durationStr = formatDurationMinutes(durationMinutes);
                        const isLongStay = durationMinutes >= 480;

                        return (
                          <tr key={record.id} className="hover:bg-gray-50">
                            <td className="whitespace-nowrap px-6 py-4">
                              <div className="flex items-center">
                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-200">
                                  <span className="text-sm font-medium text-gray-600">
                                    {record.visitor_name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .toUpperCase()
                                      .slice(0, 2)}
                                  </span>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{record.visitor_name}</div>
                                  <div className="text-sm text-gray-500">{record.visitor_phone || "Unavailable"}</div>
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
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
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                              {record.employer_name || "-"}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                              {record.sign_in_ts.toLocaleTimeString("en-NZ", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <div className="flex flex-col items-start gap-1">
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                    isLongStay
                                      ? "bg-orange-100 text-orange-800"
                                      : "bg-green-100 text-green-800"
                                  }`}
                                >
                                  {isLongStay ? "Long stay" : "On site"}
                                </span>
                                <span
                                  className={`text-sm font-medium ${
                                    isLongStay ? "text-orange-700" : "text-gray-700"
                                  }`}
                                >
                                  {durationStr}
                                </span>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-right">
                              <div className="flex flex-col items-end gap-2">
                                <SignOutButton
                                  signInId={record.id}
                                  visitorName={record.visitor_name}
                                />
                                <Link
                                  href={`/admin/incidents?site=${record.site_id}&signInId=${record.id}`}
                                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                                >
                                  Report Incident
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default async function LiveRegisterPage({
  searchParams,
}: LiveRegisterPageProps) {
  const params = await searchParams;

  return (
    <Suspense
      fallback={
        <div className="p-6">
          <div className="animate-pulse">
            <div className="mb-4 h-8 w-48 rounded bg-gray-200"></div>
            <div className="mb-8 h-4 w-32 rounded bg-gray-200"></div>
            <div className="h-64 rounded bg-gray-200"></div>
          </div>
        </div>
      }
    >
      <LiveRegisterContent siteFilter={params.site} />
    </Suspense>
  );
}
