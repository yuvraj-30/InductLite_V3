"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Intentionally avoid exposing raw error details in UI.
    console.error("Admin route error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong p-5">
        <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
          Admin workspace unavailable
        </h1>
        <p className="mt-1 text-sm text-secondary">
          We could not load this page right now.
        </p>
      </div>

      <div className="surface-panel p-6">
        <div className="rounded-xl border border-amber-400/45 bg-amber-100/70 p-4 dark:bg-amber-950/45">
          <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            Something went wrong
          </h2>
          <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
            Please try again. If the issue continues, contact support with timestamp and route.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={reset} className="btn-primary">
              Retry
            </button>
            <a href="/admin/dashboard" className="btn-secondary">
              Back to dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
