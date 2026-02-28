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
      <div className="surface-panel rounded-xl border border-emerald-500/35 bg-emerald-500/12 p-4 text-sm text-emerald-800 dark:text-emerald-100">
        Roll call is ready. No active visitors are currently on site.
      </div>
    );
  }

  return (
    <div className="surface-panel rounded-2xl p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setActive((prev) => !prev);
            if (!active) {
              setAccounted({});
            }
          }}
          className="min-h-[44px] rounded-lg border border-amber-500/45 bg-amber-500/25 px-4 py-2 text-sm font-bold text-amber-900 hover:bg-amber-500/35 dark:text-amber-100"
        >
          {active ? "End Roll Call" : "Start Evacuation Roll Call"}
        </button>
        <button
          type="button"
          onClick={() => setAccounted(Object.fromEntries(records.map((r) => [r.id, true])))}
          className="min-h-[44px] rounded-lg border ring-soft bg-glass px-4 py-2 text-sm font-semibold text-[color:var(--text-primary)] hover:bg-glass-strong"
        >
          Mark All Accounted
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-[44px] rounded-lg border ring-soft bg-glass px-4 py-2 text-sm font-semibold text-[color:var(--text-primary)] hover:bg-glass-strong"
        >
          Print Roll Call
        </button>
      </div>

      <p className="mt-3 text-sm text-secondary">
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
                      ? "border-emerald-400/45 bg-emerald-500/20 text-emerald-900 dark:text-emerald-100"
                      : "ring-soft bg-glass text-[color:var(--text-primary)]"
                  }`}
                >
                  <span className="font-semibold">{record.visitorName}</span>
                  <span className="text-xs uppercase tracking-[0.08em] text-secondary">
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
