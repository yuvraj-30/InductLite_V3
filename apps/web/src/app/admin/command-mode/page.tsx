import Link from "next/link";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import { listCurrentlyOnSite } from "@/lib/repository";
import { LiveRegisterAutoRefresh } from "../live-register/auto-refresh";
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
  const records = await listCurrentlyOnSite(context.companyId);
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
            <p className="mt-2 text-sm text-secondary sm:text-base">
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

      <section className="grid gap-4 lg:grid-cols-[1.1fr,1fr]">
        <div className="surface-panel p-4 sm:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
            Overstay Alerts
          </h2>
          {longStay.length === 0 ? (
            <p className="mt-3 text-sm text-secondary">No active long-stay visitors.</p>
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
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
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
