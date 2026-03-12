import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { buildPredictiveBenchmarkCards } from "@/lib/differentiation/benchmark";
import { buildSafetyCopilotWeeklyReport } from "@/lib/differentiation/safety-copilot-metrics";
import { PageWarningState } from "@/components/ui/page-state";

export const metadata = {
  title: "Predictive Benchmarks | InductLite",
};

export default async function PredictiveBenchmarksPage() {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  if (!isFeatureEnabled("RISK_PASSPORT_V1")) {
    return (
      <div className="space-y-6 p-3 sm:p-4">
        <div className="surface-panel-strong p-5">
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Predictive Benchmarks
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Forward-looking performance benchmarks with percentile and explainability.
          </p>
        </div>
        <PageWarningState
          title="Predictive benchmarks are disabled by rollout flag."
          description="CONTROL_ID: FLAG-ROLLOUT-001."
        />
      </div>
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "ANALYTICS_ADVANCED");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="space-y-6 p-3 sm:p-4">
          <div className="surface-panel-strong p-5">
            <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
              Predictive Benchmarks
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Forward-looking performance benchmarks with percentile and explainability.
            </p>
          </div>
          <PageWarningState
            title="Predictive benchmarks are not enabled for this plan."
            description="CONTROL_ID: PLAN-ENTITLEMENT-001."
          />
        </div>
      );
    }
    throw error;
  }

  const [cards, copilotReport] = await Promise.all([
    buildPredictiveBenchmarkCards({
      companyId: context.companyId,
      userId: context.userId,
      userRole: context.role,
    }),
    buildSafetyCopilotWeeklyReport({
      companyId: context.companyId,
      days: 7,
    }),
  ]);

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div>
        <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">Predictive Benchmarks</h1>
        <p className="mt-1 text-sm text-secondary">
          Forward-looking performance benchmarks with percentile and explainability.
        </p>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.metricKey} className="surface-panel p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-black text-[color:var(--text-primary)]">{card.currentValue}</p>
            <p className="mt-1 text-sm text-secondary">
              30d projection: <span className="font-semibold">{card.projected30d}</span>
            </p>
            <p className="mt-1 text-sm text-secondary">
              Percentile: <span className="font-semibold">{card.percentile}</span>
            </p>
          </article>
        ))}
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Explainability
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-secondary">
          {cards.map((card) => (
            <li key={`${card.metricKey}-explain`} className="rounded-xl border border-[color:var(--border-soft)] p-3">
              <p className="font-semibold text-[color:var(--text-primary)]">{card.label}</p>
              <p className="mt-1">{card.explanation}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          AI Adoption (7d)
        </h2>
        <p className="mt-1 text-sm text-secondary">
          Decision telemetry for safety copilot recommendations. Metrics intentionally
          exclude free-text prompt/note content.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-[color:var(--border-soft)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
              Copilot runs
            </p>
            <p className="mt-1 text-2xl font-black text-[color:var(--text-primary)]">
              {copilotReport.runs}
            </p>
          </article>
          <article className="rounded-xl border border-[color:var(--border-soft)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
              Decision coverage
            </p>
            <p className="mt-1 text-2xl font-black text-[color:var(--text-primary)]">
              {(copilotReport.decisionCoverageRate * 100).toFixed(1)}%
            </p>
            <p className="mt-1 text-xs text-secondary">
              {copilotReport.decisionTotal}/{copilotReport.recommendationTotal} suggestions
            </p>
          </article>
          <article className="rounded-xl border border-[color:var(--border-soft)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
              Accept / Edit / Reject
            </p>
            <p className="mt-1 text-2xl font-black text-[color:var(--text-primary)]">
              {copilotReport.accepted}/{copilotReport.edited}/{copilotReport.rejected}
            </p>
            <p className="mt-1 text-xs text-secondary">
              {(copilotReport.acceptanceRate * 100).toFixed(1)}% accept,
              {" "}
              {(copilotReport.editRate * 100).toFixed(1)}% edit
            </p>
          </article>
          <article className="rounded-xl border border-[color:var(--border-soft)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
              Accepted confidence
            </p>
            <p className="mt-1 text-2xl font-black text-[color:var(--text-primary)]">
              {copilotReport.highConfidenceAccepted}/
              {copilotReport.mediumConfidenceAccepted}/
              {copilotReport.lowConfidenceAccepted}
            </p>
            <p className="mt-1 text-xs text-secondary">High / Medium / Low</p>
          </article>
        </div>

        <div className="mt-3 rounded-xl border border-[color:var(--border-soft)] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
            Weekly Outcome Delta
          </p>
          {copilotReport.outcomeDelta ? (
            <p className="mt-1 text-sm text-secondary">
              Open permits {copilotReport.outcomeDelta.openPermits >= 0 ? "+" : ""}
              {copilotReport.outcomeDelta.openPermits}, hazards{" "}
              {copilotReport.outcomeDelta.openHazards >= 0 ? "+" : ""}
              {copilotReport.outcomeDelta.openHazards}, incidents{" "}
              {copilotReport.outcomeDelta.openIncidents >= 0 ? "+" : ""}
              {copilotReport.outcomeDelta.openIncidents}, prequal pending{" "}
              {copilotReport.outcomeDelta.prequalPending >= 0 ? "+" : ""}
              {copilotReport.outcomeDelta.prequalPending}, high-risk profiles{" "}
              {copilotReport.outcomeDelta.highRiskProfiles >= 0 ? "+" : ""}
              {copilotReport.outcomeDelta.highRiskProfiles}.
            </p>
          ) : (
            <p className="mt-1 text-sm text-secondary">
              Not enough copilot runs in the last 7 days to compute delta.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

