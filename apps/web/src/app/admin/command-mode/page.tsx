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
    <section className="rounded-3xl bg-slate-950 p-4 text-white shadow-xl sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Foreman Command Mode</h1>
          <p className="mt-1 text-sm text-slate-300">
            Live headcount, overstay alerts, and evacuation roll call.
          </p>
        </div>
        <Link
          href="/admin/live-register"
          className="rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
        >
          Open Live Register
        </Link>
      </div>

      <div className="mb-4">
        <LiveRegisterAutoRefresh intervalMs={15000} lastUpdatedIso={now.toISOString()} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/15 p-4">
          <p className="text-xs uppercase tracking-wide text-emerald-200">On Site Now</p>
          <p className="mt-1 text-4xl font-black">{rows.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/15 p-4">
          <p className="text-xs uppercase tracking-wide text-amber-200">Long Stay (8h+)</p>
          <p className="mt-1 text-4xl font-black">{longStay.length}</p>
        </div>
        <div className="rounded-2xl border border-red-400/50 bg-red-500/20 p-4">
          <p className="text-xs uppercase tracking-wide text-red-200">Critical (12h+)</p>
          <p className="mt-1 text-4xl font-black">{criticalOverstay.length}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr,1fr]">
        <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-200">
            Overstay Alerts
          </h2>
          {longStay.length === 0 ? (
            <p className="mt-3 text-sm text-emerald-200">
              No active long-stay visitors.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {longStay.slice(0, 12).map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between rounded-lg border border-amber-300/40 bg-amber-400/10 px-3 py-2"
                >
                  <div>
                    <p className="font-semibold">{row.visitorName}</p>
                    <p className="text-xs text-slate-300">{row.siteName}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      row.durationMinutes >= 720
                        ? "bg-red-500/30 text-red-100"
                        : "bg-amber-400/30 text-amber-100"
                    }`}
                  >
                    {formatDuration(row.durationMinutes)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-200">
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
      </div>
    </section>
  );
}
