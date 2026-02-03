/**
 * Simple telemetry helper for rate-limit events.
 * - In production this would forward to a metrics/analytics backend.
 * - For tests we expose a simple in-memory counter and reset function.
 */

type BlockedEvent = {
  kind: string; // e.g., 'login' | 'signin' | 'public-slug' | 'signout'
  clientKey?: string;
  meta?: Record<string, unknown>;
};

const counters = new Map<string, number>();

export function recordRateLimitBlocked(event: BlockedEvent) {
  const key = `blocked:${event.kind}`;
  counters.set(key, (counters.get(key) ?? 0) + 1);

  // Lightweight console logging for local debugging. Replace with analytics call in prod.
  if (process.env.NODE_ENV !== "test") {
    console.warn("[rate-limit] blocked:", {
      kind: event.kind,
      clientKey: event.clientKey,
    });
  }

  // If configured, send the event to a telemetry endpoint (non-blocking)
  const url = process.env.RATE_LIMIT_TELEMETRY_URL;
  if (url) {
    try {
      // Fire-and-forget; do not await so as not to block request handling
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: event.kind,
          clientKey: event.clientKey,
          meta: event.meta ?? {},
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {
      // swallow errors - telemetry should never break request flow
    }
  }
}

// Test helpers
export function getBlockedCount(kind: string): number {
  return counters.get(`blocked:${kind}`) ?? 0;
}

export function resetTelemetry(): void {
  counters.clear();
}
