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
    <div className="surface-panel flex flex-wrap items-center gap-3 px-3 py-2 text-sm text-secondary">
      <span>Last updated: {lastUpdated}</span>
      <span className="text-muted">|</span>
      <span>
        Auto-refresh {enabled ? `on (${secondsLeft}s)` : "off"}
      </span>
      <button
        type="button"
        onClick={() => setEnabled((prev) => !prev)}
        className="btn-secondary min-h-[34px] px-3 py-1.5 text-xs"
      >
        {enabled ? "Pause" : "Resume"}
      </button>
    </div>
  );
}
