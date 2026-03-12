/**
 * Live Register Page
 *
 * Shows all visitors currently on-site (sign_out_ts is null).
 * Admins can sign out visitors from this page.
 */

import { Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import {
  listCurrentlyOnSite,
  findAllSites,
  type SignInRecordWithDetails,
} from "@/lib/repository";
import { getOnboardingProgress } from "@/lib/repository/dashboard.repository";
import { SiteFilterSelect } from "./SiteFilterSelect";
import { LiveRegisterAutoRefresh } from "./auto-refresh";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import { OnboardingChecklist } from "../components/OnboardingChecklist";
import { PageEmptyState, PageLoadingState, PageWarningState } from "@/components/ui/page-state";

const SignOutButton = dynamic(
  () =>
    import("./sign-out-button").then((mod) => ({
      default: mod.SignOutButton,
    })),
);

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

function getLocationStatusMeta(record: SignInRecordWithDetails): {
  label: string;
  className: string;
} {
  if (!record.location_captured_at) {
    return {
      label: "Location unavailable",
      className: "border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] text-secondary",
    };
  }

  if (record.location_within_radius === true) {
    return {
      label: "Within site radius",
      className:
        "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100",
    };
  }

  if (record.location_within_radius === false) {
    return {
      label: "Outside site radius",
      className:
        "border-amber-400/35 bg-amber-500/15 text-amber-900 dark:text-amber-100",
    };
  }

  return {
    label: "Location captured",
    className: "border-cyan-400/35 bg-cyan-500/15 text-cyan-950 dark:text-cyan-100",
  };
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
  const mobileShellEnabled = isFeatureEnabled("UIX_S3_MOBILE");

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Live Register
          </h1>
          <p className="mt-1 text-sm text-secondary">
            {records.length} {records.length === 1 ? "person" : "people"} currently on site
          </p>
        </div>
        <Link href="/admin/history" className="text-sm font-semibold text-accent hover:underline">
          View History -&gt;
        </Link>
      </div>

      <div>
        <LiveRegisterAutoRefresh lastUpdatedIso={renderedAt.toISOString()} />
      </div>

      <div
        className={`surface-panel p-4 ${mobileShellEnabled ? "sticky top-2 z-20" : ""}`}
      >
        <form className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="site" className="label">
            Filter by site:
          </label>
          <SiteFilterSelect sites={sites} siteFilter={siteFilter} />
        </form>
      </div>

      {dataLoadFailed && (
        <PageWarningState
          title="Live register unavailable"
          description="Live register data could not be loaded. Please try again."
          actionHref="/admin/live-register"
          actionLabel="Retry"
        />
      )}

      {records.length === 0 ? (
        <PageEmptyState
          title="No one currently on site"
          description="When visitors sign in, they will appear here."
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
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
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
        <div className="space-y-6">
          {siteNames.map((siteName) => {
            const siteRecords = groupedBySite[siteName] ?? [];
            return (
              <div key={siteName} className="surface-panel overflow-hidden">
                <div className="border-b border-[color:var(--border-soft)] px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
                      {siteName}
                    </h2>
                    <span className="inline-flex items-center rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                      {siteRecords.length} on site
                    </span>
                  </div>
                </div>

                {mobileShellEnabled ? (
                  <div className="space-y-2 p-3 md:hidden">
                    {siteRecords.map((record) => {
                      const durationMinutes = Math.max(
                        0,
                        Math.floor(
                          (renderedAt.getTime() - record.sign_in_ts.getTime()) / (1000 * 60),
                        ),
                      );
                      const durationStr = formatDurationMinutes(durationMinutes);
                      const isLongStay = durationMinutes >= 480;
                      const locationStatus = getLocationStatusMeta(record);

                      return (
                        <article
                          key={record.id}
                          className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                                {record.visitor_name}
                              </p>
                              <p className="text-xs text-muted">
                                {record.visitor_phone || "Unavailable"}
                              </p>
                            </div>
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                                isLongStay
                                  ? "border-amber-400/35 bg-amber-500/15 text-amber-900 dark:text-amber-100"
                                  : "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100"
                              }`}
                            >
                              {durationStr}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                record.visitor_type === "CONTRACTOR"
                                  ? "border-cyan-400/35 bg-cyan-500/15 text-cyan-950 dark:text-cyan-100"
                                  : record.visitor_type === "VISITOR"
                                    ? "border-violet-400/35 bg-violet-500/15 text-violet-950 dark:text-violet-100"
                                    : record.visitor_type === "EMPLOYEE"
                                      ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100"
                                      : "border-amber-400/35 bg-amber-500/15 text-amber-900 dark:text-amber-100"
                              }`}
                            >
                              {record.visitor_type.toLowerCase()}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${locationStatus.className}`}
                            >
                              {locationStatus.label}
                              {record.location_distance_m !== null ? (
                                <span className="ml-1">
                                  ({Math.round(record.location_distance_m)}m)
                                </span>
                              ) : null}
                            </span>
                          </div>

                          <p className="mt-2 text-xs text-secondary">
                            Employer: {record.employer_name || "-"}
                          </p>
                          <p className="text-xs text-secondary">
                            Signed in{" "}
                            {record.sign_in_ts.toLocaleTimeString("en-NZ", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>

                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <SignOutButton
                              signInId={record.id}
                              visitorName={record.visitor_name}
                              className="w-full justify-center min-h-[42px]"
                            />
                            <Link
                              href={`/admin/incidents?site=${record.site_id}&signInId=${record.id}`}
                              className="btn-secondary min-h-[42px] justify-center px-3 py-2 text-xs"
                            >
                              Report Incident
                            </Link>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : null}

                <div className={mobileShellEnabled ? "hidden overflow-x-auto md:block" : "overflow-x-auto"}>
                  <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
                    <thead className="bg-[color:var(--bg-surface-strong)]">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                          Visitor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                          Employer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                          Signed In
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
                      {siteRecords.map((record) => {
                        const durationMinutes = Math.max(
                          0,
                          Math.floor(
                            (renderedAt.getTime() - record.sign_in_ts.getTime()) / (1000 * 60),
                          ),
                        );
                        const durationStr = formatDurationMinutes(durationMinutes);
                        const isLongStay = durationMinutes >= 480;
                        const locationStatus = getLocationStatusMeta(record);

                        return (
                          <tr
                            key={record.id}
                            className="hover:bg-[color:var(--bg-surface-strong)]"
                          >
                            <td className="whitespace-nowrap px-6 py-4">
                              <div className="flex items-center">
                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-surface-soft bg-[color:var(--bg-surface)]">
                                  <span className="text-sm font-semibold text-secondary">
                                    {record.visitor_name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .toUpperCase()
                                      .slice(0, 2)}
                                  </span>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-semibold text-[color:var(--text-primary)]">
                                    {record.visitor_name}
                                  </div>
                                  <div className="text-xs text-muted">
                                    {record.visitor_phone || "Unavailable"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                  record.visitor_type === "CONTRACTOR"
                                    ? "border-cyan-400/35 bg-cyan-500/15 text-cyan-950 dark:text-cyan-100"
                                    : record.visitor_type === "VISITOR"
                                      ? "border-violet-400/35 bg-violet-500/15 text-violet-950 dark:text-violet-100"
                                      : record.visitor_type === "EMPLOYEE"
                                        ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100"
                                        : "border-amber-400/35 bg-amber-500/15 text-amber-900 dark:text-amber-100"
                                }`}
                              >
                                {record.visitor_type.toLowerCase()}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-secondary">
                              {record.employer_name || "-"}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-secondary">
                              {record.sign_in_ts.toLocaleTimeString("en-NZ", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <div className="flex flex-col items-start gap-1">
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                                    isLongStay
                                      ? "border-amber-400/35 bg-amber-500/15 text-amber-900 dark:text-amber-100"
                                      : "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100"
                                  }`}
                                >
                                  {isLongStay ? "Long stay" : "On site"}
                                </span>
                                <span
                                  className={`text-sm font-medium ${
                                    isLongStay ? "text-amber-900 dark:text-amber-100" : "text-secondary"
                                  }`}
                                >
                                  {durationStr}
                                </span>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${locationStatus.className}`}
                                >
                                  {locationStatus.label}
                                  {record.location_distance_m !== null ? (
                                    <span className="ml-1">
                                      ({Math.round(record.location_distance_m)}m)
                                    </span>
                                  ) : null}
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
                                  className="text-xs font-semibold text-accent hover:underline"
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
        <PageLoadingState
          title="Loading live register"
          description="Fetching on-site occupancy and site filters."
        />
      }
    >
      <LiveRegisterContent siteFilter={params.site} />
    </Suspense>
  );
}

