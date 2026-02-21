"use client";

import { useEffect, useMemo, useState } from "react";

interface LiveRegisterAutoRefreshProps {
  intervalMs?: number;
  lastUpdatedIso: string;
}

export function LiveRegisterAutoRefresh({
  intervalMs = 30000,
  lastUpdatedIso,
}: LiveRegisterAutoRefreshProps) {
  const [enabled, setEnabled] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(intervalMs / 1000));
  const lastUpdated = useMemo(
    () => new Date(lastUpdatedIso).toLocaleTimeString("en-NZ"),
    [lastUpdatedIso],
  );

  useEffect(() => {
    if (!enabled) return;

    setSecondsLeft(Math.floor(intervalMs / 1000));
    const tick = window.setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? Math.floor(intervalMs / 1000) : prev - 1));
    }, 1000);

    const refresh = window.setInterval(() => {
      window.location.reload();
    }, intervalMs);

    return () => {
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, [enabled, intervalMs]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
      <span>Last updated: {lastUpdated}</span>
      <span className="text-gray-400">|</span>
      <span>
        Auto-refresh {enabled ? `on (${secondsLeft}s)` : "off"}
      </span>
      <button
        type="button"
        onClick={() => setEnabled((prev) => !prev)}
        className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        {enabled ? "Pause" : "Resume"}
      </button>
    </div>
  );
}

