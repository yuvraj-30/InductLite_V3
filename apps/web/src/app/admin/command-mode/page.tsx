import Link from "next/link";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import { listCurrentlyOnSite } from "@/lib/repository";
import { listPermitRequests } from "@/lib/repository/permit.repository";
import { findAllSites } from "@/lib/repository/site.repository";
import { PageWarningState } from "@/components/ui/page-state";
import { LiveRegisterAutoRefresh } from "../live-register/auto-refresh";
import { createEmergencyBroadcastAction } from "../communications/actions";
import { CommandRollCall } from "./roll-call";

export const metadata = {
  title: "Command Mode | InductLite",
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export default async function CommandModePage() {
  const context = await requireAuthenticatedContextReadOnly();
  const now = new Date();
  const [records, sites] = await Promise.all([
    listCurrentlyOnSite(context.companyId),
    findAllSites(context.companyId),
  ]);
  let permitsEnabled = false;
  let permitsUnavailableReason: "FLAG" | "ENTITLEMENT" | null = null;
  let permitBoard: Awaited<ReturnType<typeof listPermitRequests>> = [];
  if (isFeatureEnabled("PERMITS_V1")) {
    try {
      await assertCompanyFeatureEnabled(context.companyId, "PERMITS_V1");
      permitsEnabled = true;
      permitBoard = await listPermitRequests(context.companyId);
    } catch (error) {
      if (!(error instanceof EntitlementDeniedError)) {
        throw error;
      }
      permitsUnavailableReason = "ENTITLEMENT";
    }
  } else {
    permitsUnavailableReason = "FLAG";
  }
  const activePermitBoard = permitBoard
    .filter((permit) => !["CLOSED", "DENIED"].includes(permit.status))
    .slice(0, 10);

  const rows = records
    .map((record) => {
      const durationMinutes = Math.max(
        0,
        Math.floor((now.getTime() - record.sign_in_ts.getTime()) / (1000 * 60)),
      );
      return {
        id: record.id,
        visitorName: record.visitor_name,
        siteName: record.site.name,
        visitorType: record.visitor_type,
        signInTs: record.sign_in_ts,
        durationMinutes,
      };
    })
    .sort((a, b) => b.durationMinutes - a.durationMinutes);

  const longStay = rows.filter((row) => row.durationMinutes >= 480);
  const criticalOverstay = rows.filter((row) => row.durationMinutes >= 720);

  return (
    <div className="space-y-4">
      <section className="surface-panel-strong kinetic-hover overflow-hidden bg-gradient-to-br from-indigo-500/16 via-cyan-400/12 to-transparent p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
              Mission Control
            </p>
            <h1 className="kinetic-title mt-2 text-3xl font-black tracking-tight">
              Command Mode
            </h1>
            <p className="mt-2 text-sm text-[color:var(--text-primary)] sm:text-base">
              Live headcount, overstay alerts, and evacuation roll call.
            </p>
          </div>
          <Link
            href="/admin/live-register"
            className="btn-secondary min-h-[40px] rounded-lg px-3 py-2 text-sm font-semibold"
          >
            Open Live Register
          </Link>
        </div>

        <div className="mt-4">
          <LiveRegisterAutoRefresh intervalMs={15000} lastUpdatedIso={now.toISOString()} />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="surface-panel border-emerald-400/35 bg-emerald-500/12 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-200">
            On Site Now
          </p>
          <p className="mt-1 text-4xl font-black text-[color:var(--text-primary)]">{rows.length}</p>
        </div>
        <div className="surface-panel border-amber-400/40 bg-amber-500/12 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-200">
            Long Stay (8h+)
          </p>
          <p className="mt-1 text-4xl font-black text-[color:var(--text-primary)]">{longStay.length}</p>
        </div>
        <div className="surface-panel border-red-400/45 bg-red-500/12 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-700 dark:text-red-200">
            Critical (12h+)
          </p>
          <p className="mt-1 text-4xl font-black text-[color:var(--text-primary)]">{criticalOverstay.length}</p>
        </div>
      </section>

      {permitsEnabled ? (
        <section className="surface-panel p-4 sm:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[color:var(--text-primary)]">
            Permit Board
          </h2>
          <p className="mt-1 text-sm text-secondary">
            Live permit workload linked to today&apos;s site operations.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--surface-border)]">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Request
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Site
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Valid To
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--surface-border)]">
                {activePermitBoard.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-sm text-secondary">
                      No open permit requests.
                    </td>
                  </tr>
                ) : (
                  activePermitBoard.map((permit) => (
                    <tr key={permit.id}>
                      <td className="px-3 py-3 text-sm text-[color:var(--text-primary)]">
                        {permit.visitor_name || permit.visitor_phone || permit.id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-3 text-sm text-[color:var(--text-primary)]">
                        {sites.find((site) => site.id === permit.site_id)?.name ?? permit.site_id}
                      </td>
                      <td className="px-3 py-3 text-sm text-[color:var(--text-primary)]">
                        {permit.status}
                      </td>
                      <td className="px-3 py-3 text-sm text-[color:var(--text-primary)]">
                        {permit.validity_end
                          ? permit.validity_end.toLocaleString("en-NZ")
                          : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : permitsUnavailableReason ? (
        <section className="surface-panel p-4 sm:p-5">
          <PageWarningState
            title="Permit board is currently unavailable."
            description={
              permitsUnavailableReason === "FLAG"
                ? "Permit workflows are disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001)."
                : "Permit workflows are not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)."
            }
          />
        </section>
      ) : null}

      <section className="surface-panel p-4 sm:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[color:var(--text-primary)]">
          Emergency Broadcast Composer
        </h2>
        <p className="mt-1 text-sm text-secondary">
          Send immediate instructions to everyone currently on site from command mode.
        </p>
        <form
          action={async (formData) => {
            "use server";
            await createEmergencyBroadcastAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-3"
        >
          <label className="text-sm text-[color:var(--text-primary)]">
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
          <label className="text-sm text-[color:var(--text-primary)]">
            Severity
            <select name="severity" className="input mt-1" defaultValue="CRITICAL">
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </label>
          <label className="text-sm text-[color:var(--text-primary)]">
            Channels
            <input
              name="channels"
              className="input mt-1"
              defaultValue="EMAIL,SMS"
              placeholder="EMAIL,SMS,WEB_PUSH,TEAMS,SLACK"
            />
          </label>
          <label className="md:col-span-3 text-sm text-[color:var(--text-primary)]">
            Message
            <textarea
              name="message"
              rows={3}
              className="input mt-1"
              placeholder="Emergency instruction for all on-site personnel"
              required
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-[color:var(--text-primary)]">
            <input name="requireAck" type="checkbox" defaultChecked className="h-4 w-4" />
            Require acknowledgement
          </label>
          <div className="md:col-span-3">
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Send Broadcast
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr,1fr]">
        <div className="surface-panel p-4 sm:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[color:var(--text-primary)]">
            Overstay Alerts
          </h2>
          {longStay.length === 0 ? (
            <p className="mt-3 text-sm text-[color:var(--text-primary)]">No active long-stay visitors.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {longStay.slice(0, 12).map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between rounded-lg border border-amber-300/45 bg-amber-400/10 px-3 py-2"
                >
                  <div>
                    <p className="font-semibold text-[color:var(--text-primary)]">{row.visitorName}</p>
                    <p className="text-xs text-secondary">{row.siteName}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      row.durationMinutes >= 720
                        ? "bg-red-500/25 text-red-800 dark:text-red-100"
                        : "bg-amber-400/25 text-amber-800 dark:text-amber-100"
                    }`}
                  >
                    {formatDuration(row.durationMinutes)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[color:var(--text-primary)]">
            Evacuation Roll Call
          </h2>
          <CommandRollCall
            records={rows.map((row) => ({
              id: row.id,
              visitorName: row.visitorName,
              siteName: row.siteName,
              visitorType: row.visitorType,
              durationMinutes: row.durationMinutes,
            }))}
          />
        </div>
      </section>
    </div>
  );
}
