import Link from "next/link";
import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { findAllSites } from "@/lib/repository/site.repository";
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

export default async function CommunicationsPage() {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  if (!isFeatureEnabled("EMERGENCY_COMMS_V1")) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Communications</h1>
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Emergency communication workflows are disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001).
        </p>
      </div>
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "EMERGENCY_COMMS_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">Communications</h1>
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Emergency communication hub is not enabled for this plan (CONTROL_ID:
            PLAN-ENTITLEMENT-001).
          </p>
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
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Unified Communications Hub</h1>
          <p className="mt-1 text-sm text-gray-600">
            Launch emergency broadcasts and track multi-channel delivery + acknowledgements.
          </p>
        </div>
        <Link
          href="/admin/command-mode"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Command Mode
        </Link>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Emergency Broadcast Composer
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await createEmergencyBroadcastAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-3"
        >
          <label className="text-sm text-gray-700">
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
          <label className="text-sm text-gray-700">
            Severity
            <select name="severity" className="input mt-1" defaultValue="WARNING">
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Expires At (optional)
            <input name="expiresAt" type="datetime-local" className="input mt-1" />
          </label>
          <label className="md:col-span-3 text-sm text-gray-700">
            Message
            <textarea
              name="message"
              rows={3}
              className="input mt-1"
              placeholder="Emergency instruction for on-site workforce"
              required
            />
          </label>
          <label className="md:col-span-3 text-sm text-gray-700">
            Channels (comma-separated)
            <input
              name="channels"
              className="input mt-1"
              defaultValue="EMAIL,SMS"
              placeholder="EMAIL,SMS,WEB_PUSH,TEAMS,SLACK"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input name="requireAck" type="checkbox" defaultChecked className="h-4 w-4" />
            Require acknowledgement
          </label>
          <div className="md:col-span-3">
            <button
              type="submit"
              className="min-h-[42px] rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Send Broadcast
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Broadcast Timeline
        </h2>
        <div className="mt-3 space-y-3">
          {broadcasts.length === 0 ? (
            <p className="text-sm text-gray-500">No broadcasts yet.</p>
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
              const slaClass =
                pendingCount > 0 && elapsedMinutes > 30
                  ? "bg-red-100 text-red-800"
                  : pendingCount > 0
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800";
              return (
                <article key={broadcast.id} className="rounded-md border border-gray-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {broadcast.severity} |{" "}
                        {sites.find((site) => site.id === broadcast.site_id)?.name ?? "All sites"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {broadcast.started_at.toLocaleString("en-NZ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                        Recipients: {recipients.length} | Ack: {acknowledgedCount} | Pending:{" "}
                        {pendingCount}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${slaClass}`}>
                        SLA {elapsedMinutes}m
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-700">{broadcast.message}</p>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Communication Events
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Timestamp
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Direction
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Channel
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Event
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-sm text-gray-500">
                    No communication events logged.
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id}>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {event.created_at.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{event.direction}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{event.channel ?? "-"}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{event.event_type}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{event.status ?? "-"}</td>
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
