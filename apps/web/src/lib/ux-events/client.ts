export type InductionStep = "details" | "induction" | "signature" | "success";

export type UxEventPayload =
  | {
      event: "ux.admin.nav_search";
      path: string;
      queryLength: number;
      resultCount: number;
      sectionCount: number;
    }
  | {
      event: "ux.induction.step_transition";
      slug: string;
      fromStep: InductionStep;
      toStep: InductionStep;
      flowId?: string;
      isKiosk?: boolean;
    };

/**
 * Best-effort UX telemetry reporter.
 * Never throws and must not block the UI thread.
 */
export function reportUxEvent(payload: UxEventPayload): void {
  if (typeof window === "undefined") return;

  try {
    void fetch("/api/ux-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Best effort only.
  }
}
