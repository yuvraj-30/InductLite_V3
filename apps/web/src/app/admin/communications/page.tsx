import Link from "next/link";
import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { findAllSites } from "@/lib/repository/site.repository";
import { PageWarningState } from "@/components/ui/page-state";
import {
  listBroadcastRecipients,
  listCommunicationEvents,
  listEmergencyBroadcasts,
} from "@/lib/repository/communication.repository";
import {
  createEmergencyBroadcastAction,
} from "./actions";

export const metadata = {
  title: "Communications | InductLite",
};

function broadcastSeverityChipClass(severity: string): string {
  if (severity === "CRITICAL") {
    return "border-red-500/45 bg-red-500/15 text-red-950 dark:text-red-100";
  }
  if (severity === "WARNING") {
    return "border-amber-400/45 bg-amber-500/15 text-amber-900 dark:text-amber-100";
  }
  return "border-cyan-400/35 bg-cyan-500/15 text-cyan-950 dark:text-cyan-100";
}

function slaChipClass(pendingCount: number, elapsedMinutes: number): string {
  if (pendingCount > 0 && elapsedMinutes > 30) {
    return "border-red-500/45 bg-red-500/15 text-red-950 dark:text-red-100";
  }
  if (pendingCount > 0) {
    return "border-amber-400/45 bg-amber-500/15 text-amber-900 dark:text-amber-100";
  }
  return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
}

function communicationEventStatusChipClass(status: string | null): string {
  if (status === "FAILED") {
    return "border-red-500/45 bg-red-500/15 text-red-950 dark:text-red-100";
  }
  if (status === "DELIVERED" || status === "ACKNOWLEDGED") {
    return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
  }
  if (status === "QUEUED" || status === "PENDING") {
    return "border-amber-400/45 bg-amber-500/15 text-amber-900 dark:text-amber-100";
  }
  return "border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] text-secondary";
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

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Unified Communications Hub
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Launch emergency broadcasts and track multi-channel delivery + acknowledgements.
          </p>
        </div>
        <Link
          href="/admin/command-mode"
          className="btn-secondary"
        >
          Command Mode
        </Link>
      </div>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Emergency Broadcast Composer
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await createEmergencyBroadcastAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-3"
        >
          <label className="text-sm text-secondary">
            Site Scope
            <select name="siteId" className="input mt-1">
              <option value="">All active attendees</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-secondary">
            Severity
            <select name="severity" className="input mt-1" defaultValue="WARNING">
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </label>
          <label className="text-sm text-secondary">
            Expires At (optional)
            <input name="expiresAt" type="datetime-local" className="input mt-1" />
          </label>
          <label className="md:col-span-3 text-sm text-secondary">
            Message
            <textarea
              name="message"
              rows={3}
              className="input mt-1"
              placeholder="Emergency instruction for on-site workforce"
              required
            />
          </label>
          <label className="md:col-span-3 text-sm text-secondary">
            Channels (comma-separated)
            <input
              name="channels"
              className="input mt-1"
              defaultValue="EMAIL,SMS"
              placeholder="EMAIL,SMS,WEB_PUSH,TEAMS,SLACK"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-secondary">
            <input
              name="requireAck"
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-[color:var(--border-soft)]"
            />
            Require acknowledgement
          </label>
          <div className="md:col-span-3">
            <button
              type="submit"
              className="btn-danger"
            >
              Send Broadcast
            </button>
          </div>
        </form>
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
                        <span
                          className={`mr-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${broadcastSeverityChipClass(broadcast.severity)}`}
                        >
                          {broadcast.severity}
                        </span>
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
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${slaChipClass(pendingCount, elapsedMinutes)}`}
                      >
                        SLA {elapsedMinutes}m
                      </span>
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
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                  Timestamp
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                  Direction
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                  Channel
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                  Event
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-sm text-secondary">
                    No communication events logged.
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                    <td className="px-3 py-3 text-sm text-secondary">
                      {event.created_at.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">{event.direction}</td>
                    <td className="px-3 py-3 text-sm text-secondary">{event.channel ?? "-"}</td>
                    <td className="px-3 py-3 text-sm font-semibold text-[color:var(--text-primary)]">
                      {event.event_type}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${communicationEventStatusChipClass(event.status)}`}
                      >
                        {event.status ?? "UNKNOWN"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

