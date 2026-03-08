import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { buildPredictiveBenchmarkCards } from "@/lib/differentiation/benchmark";

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
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Predictive Benchmarks</h1>
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Predictive benchmarks are disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001).
        </p>
      </div>
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "ANALYTICS_ADVANCED");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">Predictive Benchmarks</h1>
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Predictive benchmarks are not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001).
          </p>
        </div>
      );
    }
    throw error;
  }

  const cards = await buildPredictiveBenchmarkCards({
    companyId: context.companyId,
    userId: context.userId,
    userRole: context.role,
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Predictive Benchmarks</h1>
        <p className="mt-1 text-sm text-gray-600">
          Forward-looking performance benchmarks with percentile and explainability.
        </p>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.metricKey} className="rounded-lg border bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-black text-gray-900">{card.currentValue}</p>
            <p className="mt-1 text-sm text-gray-600">
              30d projection: <span className="font-semibold">{card.projected30d}</span>
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Percentile: <span className="font-semibold">{card.percentile}</span>
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Explainability
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          {cards.map((card) => (
            <li key={`${card.metricKey}-explain`} className="rounded border border-gray-200 p-3">
              <p className="font-semibold text-gray-900">{card.label}</p>
              <p className="mt-1">{card.explanation}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
