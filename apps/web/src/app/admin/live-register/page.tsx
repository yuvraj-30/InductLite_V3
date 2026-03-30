/**
 * Live Register Page
 *
 * Shows all visitors currently on-site (sign_out_ts is null).
 * Admins can sign out visitors from this page.
 */

import { Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AdminSectionHeader } from "@/components/ui/admin-section-header";
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
import {
  PageEmptyState,
  PageLoadingState,
  PageWarningState,
} from "@/components/ui/page-state";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";

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

export interface LiveRegisterSiteGroup {
  siteId: string;
  siteName: string;
  headcount: number;
  longStayCount: number;
  locationExceptionCount: number;
  locationMissingCount: number;
  lastSignInTs: Date;
  records: SignInRecordWithDetails[];
}

export interface LiveRegisterOverview {
  activeSiteCount: number;
  headcount: number;
  longStayCount: number;
  locationExceptionCount: number;
  locationMissingCount: number;
  monitoredLocationCount: number;
  busiestSiteName: string | null;
  busiestSiteHeadcount: number;
}

const PRIMARY_SITE_GROUP_LIMIT = 3;
const ATTENTION_QUEUE_LIMIT = 5;
const LIVE_REGISTER_BADGE_CLASS =
  "whitespace-nowrap px-2 py-0.5 text-[10px] leading-4 tracking-[0.05em] sm:text-[11px]";

function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatClockTime(value: Date): string {
  return value.toLocaleTimeString("en-NZ", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRecordDurationMinutes(
  record: SignInRecordWithDetails,
  renderedAt: Date,
): number {
  return Math.max(
    0,
    Math.floor((renderedAt.getTime() - record.sign_in_ts.getTime()) / (1000 * 60)),
  );
}

function getLocationStatusMeta(record: SignInRecordWithDetails): {
  label: string;
  tone: StatusBadgeTone;
} {
  if (!record.location_captured_at) {
    return {
      label: "Location unavailable",
      tone: "neutral",
    };
  }

  if (record.location_within_radius === true) {
    return {
      label: "Location verified",
      tone: "neutral",
    };
  }

  if (record.location_within_radius === false) {
    return {
      label: "Outside site radius",
      tone: "warning",
    };
  }

  return {
    label: "Location captured",
    tone: "info",
  };
}

function getVisitorTypeTone(
  visitorType: SignInRecordWithDetails["visitor_type"],
): StatusBadgeTone {
  switch (visitorType) {
    case "CONTRACTOR":
      return "info";
    case "VISITOR":
      return "accent";
    case "EMPLOYEE":
      return "success";
    case "DELIVERY":
      return "warning";
    default:
      return "neutral";
  }
}

function getVisitorInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatVisitorTypeLabel(
  visitorType: SignInRecordWithDetails["visitor_type"],
): string {
  return visitorType
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getVisitorProfileSummary(
  record: SignInRecordWithDetails,
): string {
  const typeLabel = formatVisitorTypeLabel(record.visitor_type);
  return record.employer_name
    ? `${typeLabel} · ${record.employer_name}`
    : typeLabel;
}

function getLocationDetail(record: SignInRecordWithDetails): string {
  const locationStatus = getLocationStatusMeta(record);
  const distanceLabel =
    record.location_distance_m !== null
      ? `${Math.round(record.location_distance_m)}m`
      : null;

  return distanceLabel
    ? `${locationStatus.label} · ${distanceLabel}`
    : locationStatus.label;
}

function getSitePanelId(siteId: string): string {
  return `live-register-site-${siteId}`;
}

function getAttentionCount(group: LiveRegisterSiteGroup): number {
  return (
    group.longStayCount + group.locationExceptionCount + group.locationMissingCount
  );
}

function getSiteAttentionSummary(group: LiveRegisterSiteGroup): string {
  const parts: string[] = [];

  if (group.longStayCount > 0) {
    parts.push(
      `${group.longStayCount} long stay${group.longStayCount === 1 ? "" : "s"}`,
    );
  }

  if (group.locationExceptionCount > 0) {
    parts.push(
      `${group.locationExceptionCount} outside radius`,
    );
  }

  if (group.locationMissingCount > 0) {
    parts.push(
      `${group.locationMissingCount} location pending`,
    );
  }

  return parts.join(" · ");
}

function getAttentionQueueGroups(
  siteGroups: LiveRegisterSiteGroup[],
  limit = ATTENTION_QUEUE_LIMIT,
): LiveRegisterSiteGroup[] {
  const urgentGroups = siteGroups.filter((group) => getAttentionCount(group) > 0);
  return urgentGroups.slice(0, limit);
}

function getVisitorProfileSummaryLabel(
  record: SignInRecordWithDetails,
): string {
  return getVisitorProfileSummary(record).replace(/[Â·]+/g, "|").replace(/\s+\|\s+/g, " | ");
}

function getLocationDetailLabel(record: SignInRecordWithDetails): string {
  return getLocationDetail(record).replace(/[Â·]+/g, "|").replace(/\s+\|\s+/g, " | ");
}

function getSiteAttentionSummaryLabel(group: LiveRegisterSiteGroup): string {
  return getSiteAttentionSummary(group).replace(/[Â·]+/g, "|").replace(/\s+\|\s+/g, " | ");
}

export function buildLiveRegisterSiteGroups(
  records: SignInRecordWithDetails[],
  renderedAt: Date,
): LiveRegisterSiteGroup[] {
  const groups = new Map<string, LiveRegisterSiteGroup>();

  for (const record of records) {
    const siteId = record.site_id;
    const siteName = record.site.name;
    const durationMinutes = getRecordDurationMinutes(record, renderedAt);
    const isLongStay = durationMinutes >= 480;
    const hasLocationException = record.location_within_radius === false;
    const hasMissingLocation = !record.location_captured_at;
    const existingGroup = groups.get(siteId);

    if (!existingGroup) {
      groups.set(siteId, {
        siteId,
        siteName,
        headcount: 1,
        longStayCount: isLongStay ? 1 : 0,
        locationExceptionCount: hasLocationException ? 1 : 0,
        locationMissingCount: hasMissingLocation ? 1 : 0,
        lastSignInTs: record.sign_in_ts,
        records: [record],
      });
      continue;
    }

    existingGroup.headcount += 1;
    existingGroup.longStayCount += isLongStay ? 1 : 0;
    existingGroup.locationExceptionCount += hasLocationException ? 1 : 0;
    existingGroup.locationMissingCount += hasMissingLocation ? 1 : 0;
    if (record.sign_in_ts.getTime() > existingGroup.lastSignInTs.getTime()) {
      existingGroup.lastSignInTs = record.sign_in_ts;
    }
    existingGroup.records.push(record);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      records: [...group.records].sort((left, right) => {
        if (left.location_within_radius !== right.location_within_radius) {
          if (left.location_within_radius === false) return -1;
          if (right.location_within_radius === false) return 1;
        }
        return left.sign_in_ts.getTime() - right.sign_in_ts.getTime();
      }),
    }))
    .sort((left, right) => {
      if (right.longStayCount !== left.longStayCount) {
        return right.longStayCount - left.longStayCount;
      }
      if (right.locationExceptionCount !== left.locationExceptionCount) {
        return right.locationExceptionCount - left.locationExceptionCount;
      }
      if (right.headcount !== left.headcount) {
        return right.headcount - left.headcount;
      }
      if (right.lastSignInTs.getTime() !== left.lastSignInTs.getTime()) {
        return right.lastSignInTs.getTime() - left.lastSignInTs.getTime();
      }
      return left.siteName.localeCompare(right.siteName, "en-NZ");
    });
}

export function buildLiveRegisterOverview(
  siteGroups: LiveRegisterSiteGroup[],
): LiveRegisterOverview {
  const headcount = siteGroups.reduce((total, group) => total + group.headcount, 0);
  const longStayCount = siteGroups.reduce(
    (total, group) => total + group.longStayCount,
    0,
  );
  const locationExceptionCount = siteGroups.reduce(
    (total, group) => total + group.locationExceptionCount,
    0,
  );
  const locationMissingCount = siteGroups.reduce(
    (total, group) => total + group.locationMissingCount,
    0,
  );
  const monitoredLocationCount = siteGroups.reduce(
    (total, group) =>
      total + group.headcount - group.locationMissingCount,
    0,
  );

  const busiestSite =
    [...siteGroups].sort((left, right) => {
      if (right.headcount !== left.headcount) {
        return right.headcount - left.headcount;
      }
      return left.siteName.localeCompare(right.siteName, "en-NZ");
    })[0] ?? null;

  return {
    activeSiteCount: siteGroups.length,
    headcount,
    longStayCount,
    locationExceptionCount,
    locationMissingCount,
    monitoredLocationCount,
    busiestSiteName: busiestSite?.siteName ?? null,
    busiestSiteHeadcount: busiestSite?.headcount ?? 0,
  };
}

export function splitLiveRegisterSiteGroups(
  siteGroups: LiveRegisterSiteGroup[],
  primaryLimit = PRIMARY_SITE_GROUP_LIMIT,
): {
  primaryGroups: LiveRegisterSiteGroup[];
  secondaryGroups: LiveRegisterSiteGroup[];
} {
  return {
    primaryGroups: siteGroups.slice(0, primaryLimit),
    secondaryGroups: siteGroups.slice(primaryLimit),
  };
}

function LiveRegisterSummaryCard({
  eyebrow,
  value,
  description,
  badgeLabel,
  badgeTone = "neutral",
}: {
  eyebrow: string;
  value: string;
  description: string;
  badgeLabel?: string;
  badgeTone?: StatusBadgeTone;
}) {
  return (
    <article className="surface-panel p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {eyebrow}
          </p>
          <p className="mt-1.5 text-xl font-semibold text-[color:var(--text-primary)] sm:text-2xl">
            {value}
          </p>
        </div>
        {badgeLabel ? (
          <StatusBadge tone={badgeTone} className={LIVE_REGISTER_BADGE_CLASS}>
            {badgeLabel}
          </StatusBadge>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-secondary">{description}</p>
    </article>
  );
}

function LiveRegisterAttentionQueueRow({
  group,
  expanded,
}: {
  group: LiveRegisterSiteGroup;
  expanded: boolean;
}) {
  const attentionCount = getAttentionCount(group);
  const latestSignInLabel = formatClockTime(group.lastSignInTs);
  const attentionSummary = getSiteAttentionSummaryLabel(group);

  return (
    <article className="grid gap-3 px-4 py-2.5 sm:grid-cols-[minmax(0,1.2fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
            {group.siteName}
          </p>
          <StatusBadge tone="neutral" className={LIVE_REGISTER_BADGE_CLASS}>
            {group.headcount} on site
          </StatusBadge>
          {attentionCount > 0 ? (
            <StatusBadge tone="warning" className={LIVE_REGISTER_BADGE_CLASS}>
              {attentionCount} issue{attentionCount === 1 ? "" : "s"}
            </StatusBadge>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-secondary">
          Latest sign-in {latestSignInLabel}.{" "}
          {attentionSummary || "No active exceptions right now."}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="text-xs font-medium text-secondary">
          {expanded ? "Expanded below" : "Collapsed below"}
        </span>
        <Link
          href={
            expanded
              ? `#${getSitePanelId(group.siteId)}`
              : `/admin/live-register?site=${encodeURIComponent(group.siteId)}`
          }
          className="text-sm font-semibold text-accent hover:underline"
        >
          {expanded ? "Jump to detail" : "Focus site"}
        </Link>
      </div>
    </article>
  );
}

function LiveRegisterCompactSiteRow({
  group,
}: {
  group: LiveRegisterSiteGroup;
}) {
  const latestSignInLabel = formatClockTime(group.lastSignInTs);
  const attentionCount = getAttentionCount(group);
  const attentionSummary = getSiteAttentionSummaryLabel(group);

  return (
    <article className="grid gap-3 px-4 py-2.5 sm:grid-cols-[minmax(0,1.3fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
            {group.siteName}
          </p>
          <StatusBadge tone="neutral" className={LIVE_REGISTER_BADGE_CLASS}>
            {group.headcount} on site
          </StatusBadge>
          {attentionCount > 0 ? (
            <StatusBadge tone="warning" className={LIVE_REGISTER_BADGE_CLASS}>
              {attentionCount} issue{attentionCount === 1 ? "" : "s"}
            </StatusBadge>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-secondary">
          Latest sign-in {latestSignInLabel}.{" "}
          {attentionSummary || "Keep this site collapsed until you need attendee detail."}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="text-xs font-medium text-secondary">
          Secondary site
        </span>
        <Link
          href={`/admin/live-register?site=${encodeURIComponent(group.siteId)}`}
          className="text-sm font-semibold text-accent hover:underline"
        >
          Focus site
        </Link>
      </div>
    </article>
  );
}

function LiveRegisterSitePanel({
  group,
  renderedAt,
  mobileShellEnabled,
}: {
  group: LiveRegisterSiteGroup;
  renderedAt: Date;
  mobileShellEnabled: boolean;
}) {
  const attentionCount = getAttentionCount(group);
  const latestSignInLabel = formatClockTime(group.lastSignInTs);
  const attentionSummary = getSiteAttentionSummaryLabel(group);

  return (
    <section
      id={getSitePanelId(group.siteId)}
      className="surface-panel overflow-hidden"
    >
      <div className="border-b border-[color:var(--border-soft)] px-4 py-3.5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
                {group.siteName}
              </h2>
              <StatusBadge tone="neutral" className={LIVE_REGISTER_BADGE_CLASS}>
                {group.headcount} on site
              </StatusBadge>
              {attentionCount > 0 ? (
                <StatusBadge tone="warning" className={LIVE_REGISTER_BADGE_CLASS}>
                  {attentionCount} issue{attentionCount === 1 ? "" : "s"}
                </StatusBadge>
              ) : null}
              {attentionCount === 0 ? (
                <StatusBadge tone="neutral" className={LIVE_REGISTER_BADGE_CLASS}>
                  Stable now
                </StatusBadge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-secondary">
              Latest sign-in {latestSignInLabel}.{" "}
              {attentionCount > 0
                ? `${attentionSummary}. Keep the table below focused on the people who need action.`
                : "Occupancy is steady and ready for quick scan."}
            </p>
          </div>
        </div>
      </div>

      {mobileShellEnabled ? (
        <div className="space-y-2 p-3 md:hidden">
          {group.records.map((record) => {
            const durationMinutes = getRecordDurationMinutes(record, renderedAt);
            const durationStr = formatDurationMinutes(durationMinutes);
            const isLongStay = durationMinutes >= 480;

            return (
              <article
                key={record.id}
                className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                      {record.visitor_name}
                    </p>
                    <p className="truncate text-xs text-secondary">
                      {getVisitorProfileSummaryLabel(record)}
                    </p>
                  </div>
                  <StatusBadge
                    tone={isLongStay ? "warning" : "neutral"}
                    className={LIVE_REGISTER_BADGE_CLASS}
                  >
                    {durationStr}
                  </StatusBadge>
                </div>

                <p className="mt-1 text-xs text-muted">
                  {record.visitor_phone_display ?? "Unavailable"}
                </p>
                <p className="mt-2 text-xs text-secondary">
                  Signed in {formatClockTime(record.sign_in_ts)} | {getLocationDetailLabel(record)}
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <SignOutButton
                    signInId={record.id}
                    visitorName={record.visitor_name}
                    className="min-h-[42px] w-full justify-center"
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

      <div className={mobileShellEnabled ? "hidden md:block" : ""}>
        <DataTableShell className="rounded-none border-0 bg-transparent shadow-none">
          <DataTableScroll>
            <DataTable className="data-table-compact data-table-dense data-table-quiet min-w-[760px]">
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHeadCell>Visitor</DataTableHeadCell>
                  <DataTableHeadCell>Profile</DataTableHeadCell>
                  <DataTableHeadCell>Signed In</DataTableHeadCell>
                  <DataTableHeadCell>Status</DataTableHeadCell>
                  <DataTableHeadCell className="text-right">
                    Actions
                  </DataTableHeadCell>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {group.records.map((record) => {
                  const durationMinutes = getRecordDurationMinutes(record, renderedAt);
                  const durationStr = formatDurationMinutes(durationMinutes);
                  const isLongStay = durationMinutes >= 480;
                  const locationStatus = getLocationStatusMeta(record);

                  return (
                    <DataTableRow key={record.id}>
                      <DataTableCell className="whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-surface-soft bg-[color:var(--bg-surface)]">
                            <span className="text-xs font-semibold text-secondary">
                              {getVisitorInitials(record.visitor_name)}
                            </span>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-semibold text-[color:var(--text-primary)]">
                              {record.visitor_name}
                            </div>
                            <div className="text-xs text-muted">
                              {record.visitor_phone_display ?? "Unavailable"}
                            </div>
                          </div>
                        </div>
                      </DataTableCell>
                      <DataTableCell className="whitespace-nowrap">
                        <div className="space-y-1">
                          <StatusBadge
                            tone={getVisitorTypeTone(record.visitor_type)}
                            className={LIVE_REGISTER_BADGE_CLASS}
                          >
                            {formatVisitorTypeLabel(record.visitor_type)}
                          </StatusBadge>
                          <p className="text-xs text-secondary">
                            {record.employer_name || "No employer recorded"}
                          </p>
                        </div>
                      </DataTableCell>
                      <DataTableCell className="whitespace-nowrap">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-[color:var(--text-primary)]">
                            {formatClockTime(record.sign_in_ts)}
                          </p>
                          <p className="text-xs text-muted">{durationStr} on site</p>
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge
                              tone={isLongStay ? "warning" : "neutral"}
                              className={LIVE_REGISTER_BADGE_CLASS}
                            >
                              {isLongStay ? "Long stay" : "On site"}
                            </StatusBadge>
                            {locationStatus.tone !== "neutral" ? (
                              <StatusBadge
                                tone={locationStatus.tone}
                                className={LIVE_REGISTER_BADGE_CLASS}
                              >
                                {locationStatus.label}
                              </StatusBadge>
                            ) : null}
                          </div>
                          <p className="text-xs text-secondary">
                            {locationStatus.tone === "neutral"
                              ? locationStatus.label
                              : getLocationDetailLabel(record)}
                          </p>
                        </div>
                      </DataTableCell>
                      <DataTableCell className="whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/incidents?site=${record.site_id}&signInId=${record.id}`}
                            className="inline-flex min-h-[32px] items-center rounded-md border border-[color:var(--border-soft)] px-2.5 py-1 text-[11px] font-semibold text-secondary hover:bg-[color:var(--bg-surface)]"
                          >
                            Incident
                          </Link>
                          <SignOutButton
                            signInId={record.id}
                            visitorName={record.visitor_name}
                            className="min-h-[32px] px-2.5 py-1 text-[11px]"
                          />
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          </DataTableScroll>
        </DataTableShell>
      </div>
    </section>
  );
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

  const renderedAt = new Date();
  const mobileShellEnabled = isFeatureEnabled("UIX_S3_MOBILE");
  const siteGroups = buildLiveRegisterSiteGroups(records, renderedAt);
  const overview = buildLiveRegisterOverview(siteGroups);
  const { primaryGroups, secondaryGroups } = splitLiveRegisterSiteGroups(
    siteGroups,
    siteFilter ? siteGroups.length : PRIMARY_SITE_GROUP_LIMIT,
  );
  const primarySiteIds = new Set(primaryGroups.map((group) => group.siteId));
  const attentionQueueGroups = siteFilter
    ? []
    : getAttentionQueueGroups(siteGroups);
  const remainingAttentionSiteCount = Math.max(
    0,
    siteGroups.filter((group) => getAttentionCount(group) > 0).length -
      attentionQueueGroups.length,
  );
  const secondaryHeadcount = secondaryGroups.reduce(
    (total, group) => total + group.headcount,
    0,
  );
  const sitesNeedingAttention = siteGroups.filter(
    (group) => getAttentionCount(group) > 0,
  ).length;

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong flex flex-col gap-4 p-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Live Register
          </h1>
          <p className="mt-1 text-sm text-secondary">
            {overview.headcount} {overview.headcount === 1 ? "person" : "people"} currently on
            site across {overview.activeSiteCount} active site
            {overview.activeSiteCount === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            tone={sitesNeedingAttention > 0 ? "warning" : "neutral"}
            className={LIVE_REGISTER_BADGE_CLASS}
          >
            {sitesNeedingAttention > 0
              ? `${sitesNeedingAttention} site${sitesNeedingAttention === 1 ? "" : "s"} need attention`
              : "No urgent exceptions"}
          </StatusBadge>
          <Link
            href="/admin/history"
            className="text-sm font-semibold text-accent hover:underline"
          >
            View History -&gt;
          </Link>
        </div>
      </div>

      <LiveRegisterAutoRefresh lastUpdatedIso={renderedAt.toISOString()} />

      <section
        className={`surface-panel p-4 ${mobileShellEnabled ? "sticky top-2 z-20" : ""}`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <AdminSectionHeader
            eyebrow="Register scope"
            title="Filter the control room by site"
            description="Search directly for a site, keep the selected scope obvious, and preserve live context without a blunt document reset."
            className="flex-1"
          />

          <SiteFilterSelect sites={sites} siteFilter={siteFilter} />
        </div>
      </section>

      {dataLoadFailed ? (
        <PageWarningState
          title="Live register unavailable"
          description="Live register data could not be loaded. Please try again."
          actionHref="/admin/live-register"
          actionLabel="Retry"
        />
      ) : null}

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
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <LiveRegisterSummaryCard
              eyebrow="Active sites"
              value={String(overview.activeSiteCount)}
              description={
                siteFilter
                  ? "The selected site stays in focus until you clear the site scope."
                  : "Priority sites stay on the first screen while quieter sites collapse below."
              }
              badgeLabel={siteFilter ? "Scoped view" : "Control room"}
              badgeTone={siteFilter ? "info" : "neutral"}
            />
            <LiveRegisterSummaryCard
              eyebrow="On site now"
              value={String(overview.headcount)}
              description="Total people currently signed in across the live register scope."
              badgeLabel="Occupancy"
            />
            <LiveRegisterSummaryCard
              eyebrow="Needs attention"
              value={String(
                overview.longStayCount +
                  overview.locationExceptionCount +
                  overview.locationMissingCount,
              )}
              description={`${overview.longStayCount} long stay${overview.longStayCount === 1 ? "" : "s"}, ${overview.locationExceptionCount} location exception${overview.locationExceptionCount === 1 ? "" : "s"}, and ${overview.locationMissingCount} missing location capture${overview.locationMissingCount === 1 ? "" : "s"}.`}
              badgeLabel={sitesNeedingAttention > 0 ? "Respond now" : "Stable"}
              badgeTone={sitesNeedingAttention > 0 ? "warning" : "neutral"}
            />
            <LiveRegisterSummaryCard
              eyebrow="Busiest site"
              value={overview.busiestSiteName ?? "None"}
              description={
                overview.busiestSiteName
                  ? `${overview.busiestSiteHeadcount} people signed in. ${overview.monitoredLocationCount} monitored location capture${overview.monitoredLocationCount === 1 ? "" : "s"} are on record.`
                  : "No active site occupancy detected."
              }
              badgeLabel={
                overview.busiestSiteHeadcount > 0
                  ? `${overview.busiestSiteHeadcount} on site`
                  : undefined
              }
            />
          </section>

          {!siteFilter ? (
            <section className="space-y-3">
              <AdminSectionHeader
                eyebrow="Attention queue"
                title="Triage active exceptions before deep site detail"
                description="Surface the sites with long stays, radius breaches, or missing location first, then drill into quieter sites only when they need action."
              />

              <div className="surface-panel overflow-hidden">
                {attentionQueueGroups.length > 0 ? (
                  <div className="divide-y divide-[color:var(--border-soft)]">
                    {attentionQueueGroups.map((group) => (
                      <LiveRegisterAttentionQueueRow
                        key={group.siteId}
                        group={group}
                        expanded={primarySiteIds.has(group.siteId)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-5">
                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                      No active exception queue
                    </p>
                    <p className="mt-1 text-sm text-secondary">
                      Everyone currently on site is inside the calmer occupancy view below.
                    </p>
                  </div>
                )}

                {remainingAttentionSiteCount > 0 ? (
                  <div className="border-t border-[color:var(--border-soft)] px-4 py-3 text-xs text-secondary">
                    {remainingAttentionSiteCount} more site
                    {remainingAttentionSiteCount === 1 ? "" : "s"} still carry
                    live exceptions. Use the quieter site drawer below to focus
                    them one at a time.
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <AdminSectionHeader
              eyebrow="Expanded detail"
              title={siteFilter ? "Selected site activity" : "Expanded site detail"}
              description={
                siteFilter
                  ? "Stay focused on the selected site while the live register refreshes in place."
                  : "Keep only the most urgent or busiest site groups open, then move quieter sites into a compact drill-down drawer."
              }
            />

            <div className="space-y-4">
              {primaryGroups.map((group) => (
                <LiveRegisterSitePanel
                  key={group.siteId}
                  group={group}
                  renderedAt={renderedAt}
                  mobileShellEnabled={mobileShellEnabled}
                />
              ))}

              {secondaryGroups.length > 0 ? (
                <details className="surface-panel overflow-hidden">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                        Review {secondaryGroups.length} quieter active site
                        {secondaryGroups.length === 1 ? "" : "s"}
                      </p>
                      <p className="text-xs text-secondary">
                        Keep another {secondaryHeadcount} person
                        {secondaryHeadcount === 1 ? "" : "s"} available without
                        opening another stack of full site panels.
                      </p>
                    </div>
                    <StatusBadge tone="neutral" className={LIVE_REGISTER_BADGE_CLASS}>
                      {secondaryHeadcount} on site
                    </StatusBadge>
                  </summary>

                  <div className="divide-y divide-[color:var(--border-soft)] border-t border-[color:var(--border-soft)]">
                    {secondaryGroups.map((group) => (
                      <LiveRegisterCompactSiteRow
                        key={group.siteId}
                        group={group}
                      />
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </section>
        </>
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
