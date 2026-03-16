import Link from "next/link";
import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { findAllSites } from "@/lib/repository/site.repository";
import { PageWarningState } from "@/components/ui/page-state";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHeadCell,
  DataTableHeader,
  DataTableRow,
  DataTableScroll,
  DataTableShell,
} from "@/components/ui/data-table";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import {
  listBroadcastRecipients,
  listCommunicationEvents,
  listEmergencyBroadcasts,
} from "@/lib/repository/communication.repository";
import { EmergencyBroadcastComposer } from "./emergency-broadcast-composer";

export const metadata = {
  title: "Communications | InductLite",
};

function broadcastSeverityTone(severity: string): StatusBadgeTone {
  if (severity === "CRITICAL") return "danger";
  if (severity === "WARNING") return "warning";
  return "info";
}

function eventStatusTone(status: string | null): StatusBadgeTone {
  if (status === "FAILED") return "danger";
  if (status === "DELIVERED" || status === "ACKNOWLEDGED") return "success";
  if (status === "QUEUED" || status === "PENDING") return "warning";
  return "neutral";
}

export default async function CommunicationsPage() {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  if (!isFeatureEnabled("EMERGENCY_COMMS_V1")) {
    return (
      <div className="space-y-6 p-3 sm:p-4">
        <div className="surface-panel-strong p-5">
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Communications
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Launch emergency broadcasts and track multi-channel delivery + acknowledgements.
          </p>
        </div>
        <PageWarningState
          title="Emergency communication workflows are disabled by rollout flag."
          description="CONTROL_ID: FLAG-ROLLOUT-001."
        />
      </div>
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "EMERGENCY_COMMS_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="space-y-6 p-3 sm:p-4">
          <div className="surface-panel-strong p-5">
            <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
              Communications
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Launch emergency broadcasts and track multi-channel delivery + acknowledgements.
            </p>
          </div>
          <PageWarningState
            title="Emergency communication hub is not enabled for this plan."
            description="CONTROL_ID: PLAN-ENTITLEMENT-001."
          />
        </div>
      );
    }
    throw error;
  }

  const [sites, broadcasts, events] = await Promise.all([
    findAllSites(context.companyId),
    listEmergencyBroadcasts(context.companyId),
    listCommunicationEvents(context.companyId, { limit: 200 }),
  ]);

  const recipientsByBroadcast = new Map<
    string,
    Awaited<ReturnType<typeof listBroadcastRecipients>>
  >();
  for (const broadcast of broadcasts.slice(0, 10)) {
    recipientsByBroadcast.set(
      broadcast.id,
      await listBroadcastRecipients(context.companyId, broadcast.id),
    );
  }
  const nowTs = Date.now();
  const timelineSummary = broadcasts.reduce(
    (acc, broadcast) => {
      const recipients = recipientsByBroadcast.get(broadcast.id) ?? [];
      const acknowledgedCount = recipients.filter(
        (recipient) => recipient.status === "ACKNOWLEDGED",
      ).length;
      const pendingCount = recipients.length - acknowledgedCount;
      acc.totalRecipients += recipients.length;
      acc.totalAcknowledged += acknowledgedCount;
      acc.totalPending += pendingCount;
      return acc;
    },
    {
      totalRecipients: 0,
      totalAcknowledged: 0,
      totalPending: 0,
    },
  );
  const failedEventCount = events.filter((event) => event.status === "FAILED").length;

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1.2fr)_320px]">
          <div>
            <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
              Unified Communications Hub
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Launch emergency broadcasts, see who still needs acknowledgement, and keep delivery failures visible.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-indigo-400/35 bg-indigo-500/12 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-indigo-950 dark:text-indigo-100">
                  Broadcasts
                </p>
                <p className="mt-2 text-3xl font-black text-indigo-950 dark:text-indigo-100">
                  {broadcasts.length}
                </p>
              </div>
              <div className="rounded-xl border border-amber-400/35 bg-amber-500/12 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-900 dark:text-amber-100">
                  Pending ack
                </p>
                <p className="mt-2 text-3xl font-black text-amber-900 dark:text-amber-100">
                  {timelineSummary.totalPending}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/12 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-950 dark:text-emerald-100">
                  Acknowledged
                </p>
                <p className="mt-2 text-3xl font-black text-emerald-900 dark:text-emerald-100">
                  {timelineSummary.totalAcknowledged}
                </p>
              </div>
              <div className="rounded-xl border border-red-400/35 bg-red-500/12 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-red-950 dark:text-red-100">
                  Failures
                </p>
                <p className="mt-2 text-3xl font-black text-red-950 dark:text-red-100">
                  {failedEventCount}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/admin/command-mode"
              className="btn-secondary"
            >
              Command Mode
            </Link>
            <div className="rounded-[1.25rem] border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                Priority
              </p>
              <p className="mt-3 text-sm text-secondary">
                Focus first on broadcasts with pending acknowledgements older than 30 minutes or any failed channel events.
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Emergency Broadcast Composer
        </h2>
        <EmergencyBroadcastComposer
          sites={sites.map((site) => ({ id: site.id, name: site.name }))}
          defaultSeverity="WARNING"
          defaultChannels="EMAIL,SMS"
          includeExpiresAt
          submitLabel="Send Broadcast"
        />
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Broadcast Timeline
        </h2>
        <div className="mt-3 space-y-3">
          {broadcasts.length === 0 ? (
            <p className="text-sm text-secondary">No broadcasts yet.</p>
          ) : (
            broadcasts.map((broadcast) => {
              const recipients = recipientsByBroadcast.get(broadcast.id) ?? [];
              const acknowledgedCount = recipients.filter(
                (recipient) => recipient.status === "ACKNOWLEDGED",
              ).length;
              const pendingCount = recipients.length - acknowledgedCount;
              const elapsedMinutes = Math.max(
                0,
                Math.floor((nowTs - broadcast.started_at.getTime()) / 60000),
              );
              return (
                <article
                  key={broadcast.id}
                  className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                        <StatusBadge
                          tone={broadcastSeverityTone(broadcast.severity)}
                          className="mr-2"
                        >
                          {broadcast.severity}
                        </StatusBadge>
                        {sites.find((site) => site.id === broadcast.site_id)?.name ?? "All sites"}
                      </p>
                      <p className="text-xs text-muted">
                        {broadcast.started_at.toLocaleString("en-NZ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-2 py-0.5 text-xs text-secondary">
                        Recipients: {recipients.length} | Ack: {acknowledgedCount} | Pending:{" "}
                        {pendingCount}
                      </span>
                      <StatusBadge
                        tone={
                          pendingCount > 0 && elapsedMinutes > 30
                            ? "danger"
                            : pendingCount > 0
                              ? "warning"
                              : "success"
                        }
                      >
                        SLA {elapsedMinutes}m
                      </StatusBadge>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-secondary">{broadcast.message}</p>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="surface-panel overflow-hidden">
        <div className="border-b border-[color:var(--border-soft)] px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Communication Events
          </h2>
        </div>
        <DataTableShell className="m-4 mt-0">
          <DataTableScroll>
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHeadCell>Timestamp</DataTableHeadCell>
                  <DataTableHeadCell>Direction</DataTableHeadCell>
                  <DataTableHeadCell>Channel</DataTableHeadCell>
                  <DataTableHeadCell>Event</DataTableHeadCell>
                  <DataTableHeadCell>Status</DataTableHeadCell>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {events.length === 0 ? (
                  <DataTableEmptyRow colSpan={5}>
                    No communication events logged.
                  </DataTableEmptyRow>
                ) : (
                  events.map((event) => (
                    <DataTableRow key={event.id}>
                      <DataTableCell>{event.created_at.toLocaleString("en-NZ")}</DataTableCell>
                      <DataTableCell>{event.direction}</DataTableCell>
                      <DataTableCell>{event.channel ?? "-"}</DataTableCell>
                      <DataTableCell className="font-semibold text-[color:var(--text-primary)]">
                        {event.event_type}
                      </DataTableCell>
                      <DataTableCell>
                        <StatusBadge tone={eventStatusTone(event.status)}>
                          {event.status ?? "UNKNOWN"}
                        </StatusBadge>
                      </DataTableCell>
                    </DataTableRow>
                  ))
                )}
              </DataTableBody>
            </DataTable>
          </DataTableScroll>
        </DataTableShell>
      </section>
    </div>
  );
}

