import Link from "next/link";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { generateSafetyCopilotResponse } from "@/lib/differentiation/safety-copilot";

interface InlineCopilotPanelProps {
  companyId: string;
  prompt: string;
  siteId?: string;
  title?: string;
}

function severityChipClass(severity: "low" | "medium" | "high"): string {
  if (severity === "high") {
    return "border-red-500/45 bg-red-500/15 text-red-950 dark:text-red-100";
  }
  if (severity === "medium") {
    return "border-amber-400/45 bg-amber-500/15 text-amber-900 dark:text-amber-100";
  }
  return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
}

function confidenceChipClass(value: "low" | "medium" | "high"): string {
  if (value === "high") {
    return "border-emerald-400/35 bg-emerald-500/12 text-emerald-900 dark:text-emerald-100";
  }
  if (value === "medium") {
    return "border-amber-400/45 bg-amber-500/15 text-amber-900 dark:text-amber-100";
  }
  return "border-red-500/45 bg-red-500/15 text-red-950 dark:text-red-100";
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

export async function InlineCopilotPanel({
  companyId,
  prompt,
  siteId,
  title = "Safety Copilot Guidance",
}: InlineCopilotPanelProps) {
  if (!isFeatureEnabled("UIX_S4_AI")) {
    return null;
  }

  try {
    await assertCompanyFeatureEnabled(companyId, "POLICY_SIMULATOR_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return null;
    }
    throw error;
  }

  const guidance = await generateSafetyCopilotResponse({
    companyId,
    siteId,
    prompt,
  });

  return (
    <section className="surface-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
            {title}
          </h2>
          <p className="mt-1 text-sm text-secondary">
            Advisory only. Suggestions are draft insights and do not auto-apply changes.
          </p>
        </div>
        <Link href="/admin/safety-copilot" className="btn-secondary min-h-[34px] px-3 py-1.5 text-xs">
          Open Copilot
        </Link>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-[color:var(--text-primary)]">
        {guidance.summary}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-5">
        <Metric label="Open permits" value={guidance.signals.openPermits} />
        <Metric label="Open hazards" value={guidance.signals.openHazards} />
        <Metric label="Open incidents" value={guidance.signals.openIncidents} />
        <Metric label="Prequal pending" value={guidance.signals.prequalPending} />
        <Metric label="High-risk profiles" value={guidance.signals.highRiskProfiles} />
      </div>

      <ul className="mt-3 space-y-2">
        {guidance.recommendations.slice(0, 3).map((recommendation, index) => (
          <li
            key={`${recommendation.title}-${index}`}
            className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                {recommendation.title}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${severityChipClass(recommendation.severity)}`}
                >
                  {recommendation.severity}
                </span>
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${confidenceChipClass(recommendation.confidenceBand)}`}
                >
                  confidence {recommendation.confidenceBand}
                </span>
              </div>
            </div>
            <p className="mt-1 text-sm text-secondary">{recommendation.reason}</p>
            {recommendation.sourceSignals.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {recommendation.sourceSignals.slice(0, 3).map((signal) => (
                  <span
                    key={`${recommendation.title}-${signal.key}`}
                    className="rounded border border-[color:var(--border-soft)] px-2 py-0.5 text-[11px] text-secondary"
                  >
                    {formatSignalLabel(signal.key)}: {signal.value}
                  </span>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">{value}</p>
    </div>
  );
}
