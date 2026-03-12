"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-error-reporting";

/**
 * Global Error Boundary
 *
 * Catches runtime errors in the app and provides a recovery mechanism.
 * In production, does not expose error details to users.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({ source: "app-error-boundary", error });
    if (process.env.NODE_ENV === "development") {
      console.error("[GlobalError]", {
        message: error.message,
        digest: error.digest,
        stack: error.stack,
      });
    }
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="surface-panel-strong w-full max-w-md p-8">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        <h1 className="kinetic-title mb-2 text-center text-2xl font-black text-[color:var(--text-primary)]">
          Something went wrong
        </h1>

        <p className="mb-6 text-center text-secondary">
          We apologize for the inconvenience. An unexpected error has occurred.
        </p>

        {isDev && (
          <div className="mb-6 overflow-auto rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-4">
            <p className="font-mono text-sm text-red-600">{error.message}</p>
            {error.digest && (
              <p className="mt-2 font-mono text-xs text-muted">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        {!isDev && error.digest && (
          <p className="mb-6 text-center text-sm text-muted">
            Error reference: {error.digest}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="btn-primary w-full"
          >
            Try again
          </button>

          <a
            href="/"
            className="btn-secondary w-full"
          >
            Return home
          </a>
        </div>
      </div>
    </div>
  );
}
