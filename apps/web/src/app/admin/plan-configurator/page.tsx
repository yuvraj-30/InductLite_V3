import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { EntitlementDeniedError, assertCompanyFeatureEnabled, getEffectiveEntitlements } from "@/lib/plans";
import { buildCompanyInvoicePreview } from "@/lib/plans/invoice-preview";
import {
  listPlanChangeHistory,
  listPlanChangeRequests,
} from "@/lib/repository/plan-change.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
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
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Plan Configurator</h1>
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Plan configurator is disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001).
        </p>
      </div>
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "SELF_SERVE_CONFIG_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">Plan Configurator</h1>
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Plan configurator is not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001).
          </p>
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

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Self-Serve Plan Configurator</h1>
        <p className="mt-1 text-sm text-gray-600">
          Schedule transparent plan changes with per-site feature overrides and auditable history.
        </p>
      </div>

      {params.message ? (
        <div className={`rounded-lg border p-3 text-sm ${statusBannerClass(params.status)}`}>
          {params.message}
        </div>
      ) : null}

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Current Plan Snapshot
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div className="rounded border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-gray-600">Current Plan</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{entitlements.plan}</p>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-gray-600">Base Total</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {formatNzd(invoicePreview.baseTotalCents)}
            </p>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-gray-600">Credits</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              -{formatNzd(invoicePreview.creditTotalCents)}
            </p>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-gray-600">Estimated Monthly Total</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {formatNzd(invoicePreview.finalTotalCents)}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
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
          <label className="text-sm text-gray-700">
            Target Plan
            <select name="targetPlan" className="input mt-1" defaultValue={entitlements.plan}>
              <option value="STANDARD">STANDARD</option>
              <option value="PLUS">PLUS</option>
              <option value="PRO">PRO</option>
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Effective At
            <input name="effectiveAt" type="datetime-local" defaultValue={defaultEffectiveAt} className="input mt-1" required />
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            Company Feature Overrides JSON (optional)
            <textarea
              name="companyFeatureOverridesJson"
              rows={3}
              className="input mt-1"
              placeholder='{"TEAMS_SLACK_V1": true, "PWA_PUSH_V1": false}'
            />
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            Company Feature Credit Overrides JSON (optional)
            <textarea
              name="companyFeatureCreditOverridesJson"
              rows={3}
              className="input mt-1"
              placeholder='{"TEAMS_SLACK_V1": 200, "PWA_PUSH_V1": 200}'
            />
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            Site Overrides JSON Array (optional)
            <textarea
              name="siteOverridesJson"
              rows={4}
              className="input mt-1"
              placeholder='[{"siteId":"cuid_here","featureOverrides":{"PWA_PUSH_V1":false}}]'
            />
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
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
              className="min-h-[40px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Schedule Plan Change
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Change Request History
        </h2>
        <div className="mt-3 space-y-3">
          {requests.length === 0 ? (
            <p className="text-sm text-gray-500">No plan change requests yet.</p>
          ) : (
            requests.map((request) => (
              <article key={request.id} className="rounded-md border border-gray-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {request.target_plan} | {request.status}
                    </p>
                    <p className="text-xs text-gray-600">
                      Effective: {request.effective_at.toLocaleString("en-NZ")}
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                      Created: {request.created_at.toLocaleString("en-NZ")}
                    </p>
                  </div>
                  {request.status === "SCHEDULED" ? (
                    <form action={cancelScheduledPlanChangeAction}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <button
                        type="submit"
                        className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : null}
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Payload + Timeline
                  </summary>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <pre className="overflow-x-auto rounded bg-gray-100 p-2 text-xs text-gray-700">
{JSON.stringify(request.change_payload, null, 2)}
                    </pre>
                    <ul className="space-y-1 text-xs text-gray-700">
                      {(historyByRequestId.get(request.id) ?? []).map((history) => (
                        <li key={history.id}>
                          <span className="font-semibold">{history.action}</span>{" "}
                          <span className="text-gray-500">({history.acted_at.toLocaleString("en-NZ")})</span>
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
