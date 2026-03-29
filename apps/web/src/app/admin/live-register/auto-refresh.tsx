"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface LiveRegisterAutoRefreshProps {
  intervalMs?: number;
  lastUpdatedIso: string;
}

export function getRefreshCountdownSeconds(intervalMs: number): number {
  return Math.max(1, Math.floor(intervalMs / 1000));
}

export function LiveRegisterAutoRefresh({
  intervalMs = 30000,
  lastUpdatedIso,
}: LiveRegisterAutoRefreshProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(
    getRefreshCountdownSeconds(intervalMs),
  );
  const [isRefreshing, startTransition] = useTransition();
  const lastUpdated = useMemo(
    () => new Date(lastUpdatedIso).toLocaleTimeString("en-NZ"),
    [lastUpdatedIso],
  );

  const refreshNow = () => {
    setSecondsLeft(getRefreshCountdownSeconds(intervalMs));
    startTransition(() => {
      router.refresh();
    });
  };

  useEffect(() => {
    if (!enabled) return;

    setSecondsLeft(getRefreshCountdownSeconds(intervalMs));
    const tick = window.setInterval(() => {
      setSecondsLeft((prev) =>
        prev <= 1 ? getRefreshCountdownSeconds(intervalMs) : prev - 1,
      );
    }, 1000);

    const refresh = window.setInterval(() => {
      setSecondsLeft(getRefreshCountdownSeconds(intervalMs));
      startTransition(() => {
        router.refresh();
      });
    }, intervalMs);

    return () => {
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, [enabled, intervalMs, router, startTransition]);

  return (
    <div className="surface-panel flex flex-wrap items-center gap-3 px-3 py-2 text-sm text-secondary">
      <span>Last updated: {lastUpdated}</span>
      <span className="text-muted">|</span>
      <span>
        {isRefreshing
          ? "Refreshing now..."
          : enabled
            ? `Auto-refresh on (${secondsLeft}s)`
            : "Auto-refresh off"}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={refreshNow}
          disabled={isRefreshing}
          className="btn-secondary min-h-[34px] px-3 py-1.5 text-xs"
        >
          {isRefreshing ? "Refreshing..." : "Refresh now"}
        </button>
        <button
          type="button"
          onClick={() => setEnabled((prev) => !prev)}
          className="btn-secondary min-h-[34px] px-3 py-1.5 text-xs"
        >
          {enabled ? "Pause" : "Resume"}
        </button>
      </div>
    </div>
  );
}
