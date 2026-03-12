import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  COMPANY_TIERS,
  EntitlementDeniedError,
  assertCompanyFeatureEnabled,
  getCompanyTierPresentation,
  getEffectiveEntitlements,
  getTierPresentation,
} from "@/lib/plans";
import { buildCompanyInvoicePreview } from "@/lib/plans/invoice-preview";
import {
  listPlanChangeHistory,
  listPlanChangeRequests,
} from "@/lib/repository/plan-change.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { PageWarningState } from "@/components/ui/page-state";
import {
  applyDuePlanChangesNowAction,
  cancelScheduledPlanChangeAction,
  createScheduledPlanChangeAction,
} from "./actions";

export const metadata = {
  title: "Plan Configurator | InductLite",
};

interface PlanConfiguratorPageProps {
  searchParams?: Promise<{ status?: string; message?: string }>;
}

function formatNzd(cents: number): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(cents / 100);
}

function statusBannerClass(status: string | undefined): string {
  if (status === "ok") return "border-green-200 bg-green-50 text-green-800";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

function requestStatusClass(status: string): string {
  if (status === "APPLIED") return "border-green-300 bg-green-50 text-green-800";
  if (status === "CANCELED") return "border-slate-300 bg-slate-50 text-slate-700";
  if (status === "FAILED") return "border-red-300 bg-red-50 text-red-700";
  return "border-amber-300 bg-amber-50 text-amber-800";
}

export default async function PlanConfiguratorPage({ searchParams }: PlanConfiguratorPageProps) {
  const guard = await checkPermissionReadOnly("settings:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const params = (await searchParams) ?? {};
  const context = await requireAuthenticatedContextReadOnly();

  if (!isFeatureEnabled("SELF_SERVE_CONFIG_V1")) {
    return (
      <div className="space-y-6 p-3 sm:p-4">
        <div className="surface-panel-strong p-5">
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Plan Configurator
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Schedule transparent plan changes with per-site feature overrides and auditable history.
          </p>
        </div>
        <PageWarningState
          title="Plan configurator is disabled by rollout flag."
          description="CONTROL_ID: FLAG-ROLLOUT-001."
        />
      </div>
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "SELF_SERVE_CONFIG_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="space-y-6 p-3 sm:p-4">
          <div className="surface-panel-strong p-5">
            <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
              Plan Configurator
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Schedule transparent plan changes with per-site feature overrides and auditable history.
            </p>
          </div>
          <PageWarningState
            title="Plan configurator is not enabled for this plan."
            description="CONTROL_ID: PLAN-ENTITLEMENT-001."
          />
        </div>
      );
    }
    throw error;
  }

  const [entitlements, invoicePreview, requests] = await Promise.all([
    getEffectiveEntitlements(context.companyId),
    buildCompanyInvoicePreview(context.companyId),
    listPlanChangeRequests(context.companyId),
  ]);

  const histories = await Promise.all(
    requests.slice(0, 20).map((request) =>
      listPlanChangeHistory(context.companyId, request.id),
    ),
  );
  const historyByRequestId = new Map(
    requests.slice(0, 20).map((request, index) => [request.id, histories[index] ?? []]),
  );

  const defaultEffectiveAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
  const companyTierCards = COMPANY_TIERS.map((tier) => getCompanyTierPresentation(tier));
  const addOnsTier = getTierPresentation("ADD_ONS");
  const currentTier = getCompanyTierPresentation(entitlements.plan);

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div>
        <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">Self-Serve Plan Configurator</h1>
        <p className="mt-1 text-sm text-secondary">
          Schedule transparent plan changes with per-site feature overrides and auditable history.
        </p>
      </div>

      {params.message ? (
        <div className={`rounded-lg border p-3 text-sm ${statusBannerClass(params.status)}`}>
          {params.message}
        </div>
      ) : null}

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Current Plan Snapshot
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-secondary">Current Plan</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant={currentTier.badgeTone}>{currentTier.label}</Badge>
              <p className="text-xs text-secondary">{currentTier.subtitle}</p>
            </div>
          </div>
          <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-secondary">Base Total</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">
              {formatNzd(invoicePreview.baseTotalCents)}
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-secondary">Credits</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">
              -{formatNzd(invoicePreview.creditTotalCents)}
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-secondary">Estimated Monthly Total</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">
              {formatNzd(invoicePreview.finalTotalCents)}
            </p>
          </div>
        </div>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Tier Coverage Matrix
        </h2>
        <p className="mt-2 text-sm text-secondary">
          Plan changes update Standard, Plus, and Pro entitlements. Add-ons stay optional and are applied separately by entitlement toggles.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-4">
          {companyTierCards.map((tier) => (
            <article
              key={tier.key}
              className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3"
            >
              <Badge variant={tier.badgeTone}>{tier.label}</Badge>
              <p className="mt-2 text-xs text-secondary">{tier.audience}</p>
              <ul className="mt-2 space-y-1 text-xs text-secondary">
                {tier.highlights.slice(0, 3).map((item) => (
                  <li key={item} className="rounded-md bg-[color:var(--bg-surface)] px-2 py-1">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
          <article className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3">
            <Badge variant={addOnsTier.badgeTone}>{addOnsTier.label}</Badge>
            <p className="mt-2 text-xs text-secondary">{addOnsTier.audience}</p>
            <ul className="mt-2 space-y-1 text-xs text-secondary">
              {addOnsTier.highlights.slice(0, 3).map((item) => (
                <li key={item} className="rounded-md bg-[color:var(--bg-surface)] px-2 py-1">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="surface-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
            Schedule Change Request
          </h2>
          <form action={applyDuePlanChangesNowAction}>
            <button
              type="submit"
              className="rounded border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
            >
              Apply Due Changes Now
            </button>
          </form>
        </div>

        <form action={createScheduledPlanChangeAction} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-secondary">
            Target Plan
            <select name="targetPlan" className="input mt-1" defaultValue={entitlements.plan}>
              {companyTierCards.map((tier) => (
                <option key={tier.key} value={tier.key}>
                  {tier.label.toUpperCase()} - {tier.subtitle}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-secondary">
            Effective At
            <input name="effectiveAt" type="datetime-local" defaultValue={defaultEffectiveAt} className="input mt-1" required />
          </label>
          <label className="text-sm text-secondary md:col-span-2">
            Company Feature Overrides JSON (optional)
            <textarea
              name="companyFeatureOverridesJson"
              rows={3}
              className="input mt-1"
              placeholder='{"TEAMS_SLACK_V1": true, "PWA_PUSH_V1": false}'
            />
          </label>
          <label className="text-sm text-secondary md:col-span-2">
            Company Feature Credit Overrides JSON (optional)
            <textarea
              name="companyFeatureCreditOverridesJson"
              rows={3}
              className="input mt-1"
              placeholder='{"TEAMS_SLACK_V1": 200, "PWA_PUSH_V1": 200}'
            />
          </label>
          <label className="text-sm text-secondary md:col-span-2">
            Site Overrides JSON Array (optional)
            <textarea
              name="siteOverridesJson"
              rows={4}
              className="input mt-1"
              placeholder='[{"siteId":"cuid_here","featureOverrides":{"PWA_PUSH_V1":false}}]'
            />
          </label>
          <label className="text-sm text-secondary md:col-span-2">
            Rollback Payload JSON (optional)
            <textarea
              name="rollbackPayloadJson"
              rows={3}
              className="input mt-1"
              placeholder='{"targetPlan":"STANDARD"}'
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="btn-primary"
            >
              Schedule Plan Change
            </button>
          </div>
        </form>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Change Request History
        </h2>
        <div className="mt-3 space-y-3">
          {requests.length === 0 ? (
            <p className="text-sm text-muted">No plan change requests yet.</p>
          ) : (
            requests.map((request) => (
              <article key={request.id} className="rounded-md border border-[color:var(--border-soft)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getCompanyTierPresentation(request.target_plan).badgeTone}>
                        {getCompanyTierPresentation(request.target_plan).label}
                      </Badge>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${requestStatusClass(request.status)}`}
                      >
                        {request.status}
                      </span>
                    </div>
                    <p className="text-xs text-secondary">
                      Effective: {request.effective_at.toLocaleString("en-NZ")}
                    </p>
                    <p className="mt-1 text-xs text-secondary">
                      Created: {request.created_at.toLocaleString("en-NZ")}
                    </p>
                  </div>
                  {request.status === "SCHEDULED" ? (
                    <form action={cancelScheduledPlanChangeAction}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <button
                        type="submit"
                        className="btn-secondary min-h-[30px] px-2 py-1 text-xs"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : null}
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Payload + Timeline
                  </summary>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <pre className="overflow-x-auto rounded bg-[color:var(--bg-surface-strong)] p-2 text-xs text-secondary">
{JSON.stringify(request.change_payload, null, 2)}
                    </pre>
                    <ul className="space-y-1 text-xs text-secondary">
                      {(historyByRequestId.get(request.id) ?? []).map((history) => (
                        <li key={history.id}>
                          <span className="font-semibold">{history.action}</span>{" "}
                          <span className="text-muted">({history.acted_at.toLocaleString("en-NZ")})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

