/**
 * Live Register Page
 *
 * Shows all visitors currently on-site (sign_out_ts is null).
 * Admins can sign out visitors from this page.
 */

import { Suspense } from "react";
import Link from "next/link";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import {
  listCurrentlyOnSite,
  findAllSites,
  type SignInRecordWithDetails,
} from "@/lib/repository";
import { SignOutButton } from "./sign-out-button";
import { SiteFilterSelect } from "./SiteFilterSelect";

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

async function LiveRegisterContent({
  siteFilter,
}: {
  siteFilter: string | undefined;
}) {
  const context = await requireAuthenticatedContextReadOnly();

  const [records, sites] = (await Promise.all([
    listCurrentlyOnSite(context.companyId, siteFilter),
    findAllSites(context.companyId),
  ])) as [SignInRecordWithDetails[], Site[]];

  // Group by site
  const groupedBySite = records.reduce<
    Record<string, SignInRecordWithDetails[]>
  >((acc, record) => {
    const siteName = record.site.name;
    if (!acc[siteName]) {
      acc[siteName] = [];
    }
    acc[siteName].push(record);
    return acc;
  }, {});

  const siteNames = Object.keys(groupedBySite).sort();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Register</h1>
          <p className="text-gray-600 mt-1">
            {records.length} {records.length === 1 ? "person" : "people"}{" "}
            currently on site
          </p>
        </div>
        <Link
          href="/admin/history"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          View History →
        </Link>
      </div>

      {/* Site Filter */}
      <div className="mb-6">
        <form className="flex items-center gap-4">
          <label htmlFor="site" className="text-sm font-medium text-gray-700">
            Filter by site:
          </label>
          <SiteFilterSelect sites={sites} siteFilter={siteFilter} />
        </form>
      </div>

      {records.length === 0 ? (
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
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No one currently on site
          </h3>
          <p className="text-gray-600">
            When visitors sign in, they will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {siteNames.map((siteName) => {
            const siteRecords = groupedBySite[siteName] ?? [];
            return (
              <div key={siteName} className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium text-gray-900">
                      {siteName}
                    </h2>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {siteRecords.length} on site
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Visitor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Employer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Signed In
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
                      {siteRecords.map((record) => {
                        const duration = Math.round(
                          (Date.now() - record.sign_in_ts.getTime()) /
                            (1000 * 60),
                        );
                        const hours = Math.floor(duration / 60);
                        const minutes = duration % 60;
                        const durationStr =
                          hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

                        return (
                          <tr key={record.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
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
                                  <div className="text-sm font-medium text-gray-900">
                                    {record.visitor_name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {record.visitor_phone}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
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
                              {record.sign_in_ts.toLocaleTimeString("en-NZ", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`text-sm ${duration > 480 ? "text-orange-600 font-medium" : "text-gray-500"}`}
                              >
                                {durationStr}
                                {duration > 480 && " ⚠️"}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <SignOutButton
                                signInId={record.id}
                                visitorName={record.visitor_name}
                              />
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
            <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-32 mb-8"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      }
    >
      <LiveRegisterContent siteFilter={params.site} />
    </Suspense>
  );
}
