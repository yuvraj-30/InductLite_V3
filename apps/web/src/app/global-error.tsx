"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-error-reporting";

/**
 * Root Global Error Boundary
 *
 * Catches errors that occur in the root layout itself.
 * Must include its own <html> and <body> tags since it replaces the root layout.
 */
export default function RootGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({ source: "root-error-boundary", error });
    if (process.env.NODE_ENV === "development") {
      console.error("[RootGlobalError]", {
        message: error.message,
        digest: error.digest,
        stack: error.stack,
      });
    }
  }, [error]);

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-screen antialiased">
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
              Application Error
            </h1>

            <p className="mb-6 text-center text-secondary">
              A critical error has occurred. Please try refreshing the page.
            </p>

            {error.digest && (
              <p className="mb-6 text-center text-sm text-muted">
                Reference: {error.digest}
              </p>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={reset}
                className="btn-primary w-full"
              >
                Try again
              </button>

              <button
                onClick={() => (window.location.href = "/")}
                className="btn-secondary w-full"
              >
                Return home
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
