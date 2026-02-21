"use client";

import { useMemo, useState } from "react";

type RollCallRecord = {
  id: string;
  visitorName: string;
  siteName: string;
  visitorType: string;
  durationMinutes: number;
};

interface CommandRollCallProps {
  records: RollCallRecord[];
}

export function CommandRollCall({ records }: CommandRollCallProps) {
  const [active, setActive] = useState(false);
  const [accounted, setAccounted] = useState<Record<string, true>>({});

  const accountedCount = useMemo(
    () => records.filter((record) => accounted[record.id]).length,
    [accounted, records],
  );

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-sm text-emerald-100">
        Roll call is ready. No active visitors are currently on site.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setActive((prev) => !prev);
            if (!active) {
              setAccounted({});
            }
          }}
          className="min-h-[48px] rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300"
        >
          {active ? "End Roll Call" : "Start Evacuation Roll Call"}
        </button>
        <button
          type="button"
          onClick={() => setAccounted(Object.fromEntries(records.map((r) => [r.id, true])))}
          className="min-h-[48px] rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
        >
          Mark All Accounted
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-[48px] rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
        >
          Print Roll Call
        </button>
      </div>

      <p className="mt-3 text-sm text-slate-200">
        Accounted: {accountedCount} / {records.length}
      </p>

      {active && (
        <ul className="mt-4 space-y-2">
          {records.map((record) => {
            const isAccounted = Boolean(accounted[record.id]);
            return (
              <li key={record.id}>
                <button
                  type="button"
                  onClick={() =>
                    setAccounted((prev) => {
                      const next = { ...prev };
                      if (next[record.id]) {
                        delete next[record.id];
                      } else {
                        next[record.id] = true;
                      }
                      return next;
                    })
                  }
                  className={`flex min-h-[52px] w-full items-center justify-between rounded-lg border px-3 py-2 text-left ${
                    isAccounted
                      ? "border-emerald-300 bg-emerald-400/20 text-emerald-100"
                      : "border-white/20 bg-slate-900/30 text-white"
                  }`}
                >
                  <span className="font-semibold">{record.visitorName}</span>
                  <span className="text-xs uppercase tracking-wide">
                    {record.siteName} | {record.visitorType} | {record.durationMinutes}m
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
