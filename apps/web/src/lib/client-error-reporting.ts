export type ClientErrorSource = "app-error-boundary" | "root-error-boundary";

interface ReportClientErrorInput {
  source: ClientErrorSource;
  error: Error & { digest?: string };
}

/**
 * Best-effort client crash reporter.
 * Never throws and never blocks rendering recovery.
 */
export function reportClientError({ source, error }: ReportClientErrorInput): void {
  if (typeof window === "undefined") return;

  const payload = {
    source,
    message: error.message,
    digest: error.digest,
    stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    path: window.location.pathname,
    userAgent: navigator.userAgent,
  };

  try {
    void fetch("/api/client-errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Best effort only - never break UI recovery on telemetry failures.
  }
}
