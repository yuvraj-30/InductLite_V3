"use client";

import { useEffect } from "react";

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
    // Log error to monitoring service in production
    // The digest is a hash that can be used to match server-side logs
    console.error("[GlobalError]", {
      message: error.message,
      digest: error.digest,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
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

        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
          Something went wrong
        </h1>

        <p className="mb-6 text-center text-gray-600">
          We apologize for the inconvenience. An unexpected error has occurred.
        </p>

        {isDev && (
          <div className="mb-6 overflow-auto rounded-md bg-gray-100 p-4">
            <p className="font-mono text-sm text-red-600">{error.message}</p>
            {error.digest && (
              <p className="mt-2 font-mono text-xs text-gray-500">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        {!isDev && error.digest && (
          <p className="mb-6 text-center text-sm text-gray-500">
            Error reference: {error.digest}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try again
          </button>

          <a
            href="/"
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-center font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Return home
          </a>
        </div>
      </div>
    </div>
  );
}
