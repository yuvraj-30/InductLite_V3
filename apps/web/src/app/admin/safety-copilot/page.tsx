import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { listCommunicationEvents } from "@/lib/repository/communication.repository";
import { findAllSites } from "@/lib/repository/site.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { PageWarningState } from "@/components/ui/page-state";
import { recordSafetyCopilotDecisionAction, runSafetyCopilotAction } from "./actions";

export const metadata = {
  title: "Safety Copilot | InductLite",
};

type DecisionStatus = "ACCEPTED" | "REJECTED" | "EDITED";

type ParsedRecommendation = {
  title: string;
  reason: string;
  severity: "low" | "medium" | "high";
  confidenceBand: "low" | "medium" | "high";
  sourceSignals: Array<{ key: string; value: number }>;
};

function parsePayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function parseRecommendation(value: unknown): ParsedRecommendation {
  const row =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const sourceSignals = Array.isArray(row.sourceSignals)
    ? row.sourceSignals
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const signal = item as Record<string, unknown>;
          const key = typeof signal.key === "string" ? signal.key : "signal";
          const valueNumber =
            typeof signal.value === "number" && Number.isFinite(signal.value)
              ? signal.value
              : 0;
          return { key, value: valueNumber };
        })
        .filter((item): item is { key: string; value: number } => item !== null)
    : [];

  const severity =
    row.severity === "high" || row.severity === "medium" || row.severity === "low"
      ? row.severity
      : "low";
  const confidenceBand =
    row.confidenceBand === "high" ||
    row.confidenceBand === "medium" ||
    row.confidenceBand === "low"
      ? row.confidenceBand
      : "low";

  return {
    title: typeof row.title === "string" ? row.title : "Recommendation",
    reason: typeof row.reason === "string" ? row.reason : "No reason available.",
    severity,
    confidenceBand,
    sourceSignals,
  };
}

function decisionBadgeClass(status: DecisionStatus): string {
  if (status === "ACCEPTED") {
    return "border-emerald-400/40 bg-emerald-500/12 text-emerald-900 dark:text-emerald-100";
  }
  if (status === "EDITED") {
    return "border-indigo-400/45 bg-indigo-500/12 text-indigo-900 dark:text-indigo-100";
  }
  return "border-red-400/45 bg-red-500/12 text-red-900 dark:text-red-100";
}

function confidenceBadgeClass(value: "low" | "medium" | "high"): string {
  if (value === "high") {
    return "border-emerald-400/40 bg-emerald-500/12 text-emerald-900 dark:text-emerald-100";
  }
  if (value === "medium") {
    return "border-amber-400/45 bg-amber-500/15 text-amber-900 dark:text-amber-100";
  }
  return "border-red-400/45 bg-red-500/12 text-red-900 dark:text-red-100";
}

function formatSignalLabel(value: string): string {
  switch (value) {
    case "openPermits":
      return "Open permits";
    case "openHazards":
      return "Open hazards";
    case "openIncidents":
      return "Open incidents";
    case "prequalPending":
      return "Prequal pending";
    case "highRiskProfiles":
      return "High-risk profiles";
    default:
      return value;
  }
}

export default async function SafetyCopilotPage() {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  if (!isFeatureEnabled("POLICY_SIMULATOR_V1")) {
    return (
      <div className="space-y-6 p-3 sm:p-4">
        <div className="surface-panel-strong p-5">
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Safety Copilot
          </h1>
          <p className="mt-1 text-sm text-secondary">
            AI-assisted permit/safety guidance grounded in tenant-scoped operational signals.
          </p>
        </div>
        <PageWarningState
          title="Safety copilot is disabled by rollout flag."
          description="CONTROL_ID: FLAG-ROLLOUT-001."
        />
      </div>
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "POLICY_SIMULATOR_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="space-y-6 p-3 sm:p-4">
          <div className="surface-panel-strong p-5">
            <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
              Safety Copilot
            </h1>
            <p className="mt-1 text-sm text-secondary">
              AI-assisted permit/safety guidance grounded in tenant-scoped operational signals.
            </p>
          </div>
          <PageWarningState
            title="Safety copilot is not enabled for this plan."
            description="CONTROL_ID: PLAN-ENTITLEMENT-001."
          />
        </div>
      );
    }
    throw error;
  }

  const [sites, runEvents, decisionEvents] = await Promise.all([
    findAllSites(context.companyId),
    listCommunicationEvents(context.companyId, {
      event_type: "ai.copilot.run",
      limit: 40,
    }),
    listCommunicationEvents(context.companyId, {
      event_type: "ai.copilot.decision",
      limit: 400,
    }),
  ]);

  const latestDecisionByRecommendation = new Map<
    string,
    { status: DecisionStatus; createdAt: Date }
  >();

  for (const decisionEvent of decisionEvents) {
    const payload = parsePayload(decisionEvent.payload);
    const runEventId =
      typeof payload.run_event_id === "string" ? payload.run_event_id : "";
    const recommendationIndex =
      typeof payload.recommendation_index === "number"
        ? payload.recommendation_index
        : -1;
    const status = decisionEvent.status;
    if (
      !runEventId ||
      recommendationIndex < 0 ||
      (status !== "ACCEPTED" && status !== "REJECTED" && status !== "EDITED")
    ) {
      continue;
    }

    const key = `${runEventId}:${recommendationIndex}`;
    if (!latestDecisionByRecommendation.has(key)) {
      latestDecisionByRecommendation.set(key, {
        status,
        createdAt: decisionEvent.created_at,
      });
    }
  }

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div>
        <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
          Safety Copilot
        </h1>
        <p className="mt-1 text-sm text-secondary">
          AI-assisted permit/safety guidance grounded in tenant-scoped operational signals.
        </p>
      </div>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Run Copilot
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await runSafetyCopilotAction(null, formData);
          }}
          className="mt-3 grid gap-3"
        >
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm text-secondary">
              Site scope
              <select name="siteId" className="input mt-1">
                <option value="">All sites</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-sm text-secondary">
            Prompt
            <textarea
              name="prompt"
              required
              minLength={8}
              className="input mt-1 min-h-[140px]"
              placeholder="Example: Which controls should I prioritize this week to reduce sign-in risk at our high-volume sites?"
            />
          </label>
          <div>
            <button type="submit" className="btn-primary">
              Run Safety Copilot
            </button>
          </div>
        </form>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Recent Copilot Runs
        </h2>
        <div className="mt-3 space-y-3">
          {runEvents.length === 0 ? (
            <p className="text-sm text-muted">No safety copilot runs yet.</p>
          ) : (
            runEvents.map((event) => {
              const payload = parsePayload(event.payload);
              const summary =
                typeof payload.summary === "string"
                  ? payload.summary
                  : "No summary available.";
              const recommendations = Array.isArray(payload.recommendations)
                ? payload.recommendations
                : [];
              const prompt = typeof payload.prompt === "string" ? payload.prompt : "";

              return (
                <article
                  key={event.id}
                  className="rounded-xl border border-[color:var(--border-soft)] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                      {event.created_at.toLocaleString("en-NZ")}
                    </p>
                    <span className="rounded border border-[color:var(--border-soft)] px-2 py-0.5 text-xs text-secondary">
                      {event.status ?? "COMPLETED"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-secondary">
                    <span className="font-semibold">Prompt:</span> {prompt}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">{summary}</p>

                  {recommendations.length > 0 ? (
                    <ul className="mt-3 space-y-3">
                      {recommendations.map((item, index) => {
                        const recommendation = parseRecommendation(item);
                        const decisionKey = `${event.id}:${index}`;
                        const decision = latestDecisionByRecommendation.get(decisionKey);

                        return (
                          <li
                            key={`${event.id}-${index}`}
                            className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                                {recommendation.title}
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${confidenceBadgeClass(recommendation.confidenceBand)}`}
                                >
                                  Confidence: {recommendation.confidenceBand}
                                </span>
                                {decision ? (
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${decisionBadgeClass(decision.status)}`}
                                  >
                                    {decision.status}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <p className="mt-1 text-sm text-secondary">{recommendation.reason}</p>

                            {recommendation.sourceSignals.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {recommendation.sourceSignals.map((signal) => (
                                  <span
                                    key={`${event.id}-${index}-${signal.key}`}
                                    className="rounded border border-[color:var(--border-soft)] px-2 py-0.5 text-[11px] text-secondary"
                                  >
                                    {formatSignalLabel(signal.key)}: {signal.value}
                                  </span>
                                ))}
                              </div>
                            ) : null}

                            <form
                              action={async (formData) => {
                                "use server";
                                await recordSafetyCopilotDecisionAction(null, formData);
                              }}
                              className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]"
                            >
                              <input type="hidden" name="runEventId" value={event.id} />
                              <input
                                type="hidden"
                                name="recommendationIndex"
                                value={String(index)}
                              />
                              <input type="hidden" name="noteLength" value="0" />
                              <label className="text-xs text-secondary">
                                Decision reason
                                <select
                                  name="reasonCode"
                                  defaultValue="ops_review"
                                  className="input mt-1 min-h-[38px] text-xs"
                                >
                                  <option value="ops_review">Ops review decision</option>
                                  <option value="policy_alignment">Policy alignment</option>
                                  <option value="resource_constraint">Resource constraint</option>
                                  <option value="insufficient_confidence">Insufficient confidence</option>
                                  <option value="manual_override">Manual override</option>
                                </select>
                              </label>
                              <div className="flex flex-wrap items-end gap-2">
                                <button
                                  type="submit"
                                  name="decision"
                                  value="ACCEPTED"
                                  className="rounded-md border border-emerald-400/45 bg-emerald-500/12 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-500/20 dark:text-emerald-100"
                                >
                                  Accept
                                </button>
                                <button
                                  type="submit"
                                  name="decision"
                                  value="EDITED"
                                  className="rounded-md border border-indigo-400/45 bg-indigo-500/12 px-3 py-2 text-xs font-semibold text-indigo-900 hover:bg-indigo-500/20 dark:text-indigo-100"
                                >
                                  Accept with edits
                                </button>
                                <button
                                  type="submit"
                                  name="decision"
                                  value="REJECTED"
                                  className="rounded-md border border-red-400/45 bg-red-500/12 px-3 py-2 text-xs font-semibold text-red-900 hover:bg-red-500/20 dark:text-red-100"
                                >
                                  Reject
                                </button>
                              </div>
                            </form>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
