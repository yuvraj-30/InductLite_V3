import { redirect } from "next/navigation";
import Link from "next/link";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import {
  findPolicySimulationResultByRunId,
  listPolicySimulationRuns,
  listPolicySimulations,
} from "@/lib/repository/policy-simulator.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { PageWarningState } from "@/components/ui/page-state";
import {
  createPolicySimulationAction,
  runPolicySimulationAction,
} from "./actions";

export const metadata = {
  title: "Policy Simulator | InductLite",
};

interface PolicySimulatorPageProps {
  searchParams?: Promise<{ status?: string; message?: string }>;
}

function statusBannerClass(status: string | undefined): string {
  if (status === "ok") return "border-green-200 bg-green-50 text-green-800";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

export default async function PolicySimulatorPage({ searchParams }: PolicySimulatorPageProps) {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const params = (await searchParams) ?? {};
  const context = await requireAuthenticatedContextReadOnly();

  if (!isFeatureEnabled("POLICY_SIMULATOR_V1")) {
    return (
      <div className="space-y-6 p-3 sm:p-4">
        <div className="surface-panel-strong p-5">
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Safety Policy Simulator
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Build policy scenarios and replay them against historical data to estimate operational impact.
          </p>
        </div>
        <PageWarningState
          title="Policy simulator is disabled by rollout flag."
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
              Safety Policy Simulator
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Build policy scenarios and replay them against historical data to estimate operational impact.
            </p>
          </div>
          <PageWarningState
            title="Policy simulator is not enabled for this plan."
            description="CONTROL_ID: PLAN-ENTITLEMENT-001."
          />
        </div>
      );
    }
    throw error;
  }

  const [simulations, runs] = await Promise.all([
    listPolicySimulations(context.companyId),
    listPolicySimulationRuns(context.companyId, { limit: 200 }),
  ]);

  const results = await Promise.all(
    runs.map((run) => findPolicySimulationResultByRunId(context.companyId, run.id)),
  );
  const resultsByRunId = new Map(
    results
      .filter((result) => result !== null)
      .map((result) => [result!.policy_simulation_run_id, result!]),
  );
  const simulationNameById = new Map(simulations.map((simulation) => [simulation.id, simulation.name]));

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div>
        <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">Safety Policy Simulator</h1>
        <p className="mt-1 text-sm text-secondary">
          Build policy scenarios and replay them against historical data to estimate operational impact.
        </p>
      </div>

      {params.message ? (
        <div className={`rounded-lg border p-3 text-sm ${statusBannerClass(params.status)}`}>
          {params.message}
        </div>
      ) : null}

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Create Scenario
        </h2>
        <form action={createPolicySimulationAction} className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-sm text-secondary">
            Scenario Name
            <input
              name="name"
              className="input mt-1"
              placeholder="After-hours tightening scenario"
              required
            />
          </label>
          <label className="text-sm text-secondary">
            Lookback Days
            <input name="lookbackDays" type="number" min={1} max={365} defaultValue={30} className="input mt-1" />
          </label>
          <label className="text-sm text-secondary">
            Random Check %
            <input
              name="randomCheckPercentage"
              type="number"
              min={0}
              max={100}
              defaultValue={10}
              className="input mt-1"
            />
          </label>
          <label className="text-sm text-secondary">
            Stricter Quiz Delta
            <input
              name="stricterQuizThresholdDelta"
              type="number"
              min={0}
              max={50}
              defaultValue={5}
              className="input mt-1"
            />
          </label>
          <label className="flex items-center gap-2 self-end text-sm text-secondary">
            <input name="permitRequired" type="checkbox" className="h-4 w-4" />
            Assume permit required at sign-in
          </label>
          <div className="md:col-span-3">
            <button
              type="submit"
              className="btn-primary"
            >
              Save Scenario
            </button>
          </div>
        </form>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Scenarios
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Name</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Created</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Scenario</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {simulations.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-sm text-muted">No simulation scenarios created yet.</td>
                </tr>
              ) : (
                simulations.map((simulation) => (
                  <tr key={simulation.id}>
                    <td className="px-3 py-3 text-sm font-medium text-[color:var(--text-primary)]">{simulation.name}</td>
                    <td className="px-3 py-3 text-sm text-secondary">
                      {simulation.created_at.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-3 py-3 text-xs text-secondary">
                      <code className="inline-block max-w-[28rem] truncate rounded bg-[color:var(--bg-surface-strong)] px-1 py-0.5">
                        {JSON.stringify(simulation.scenario)}
                      </code>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <form action={runPolicySimulationAction}>
                        <input type="hidden" name="simulationId" value={simulation.id} />
                        <button
                          type="submit"
                          className="rounded border border-indigo-300 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                        >
                          Run Simulation
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Recent Runs
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Run</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Blocked Est.</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Approval Load</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">False Positives</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-sm text-muted">No simulation runs yet.</td>
                </tr>
              ) : (
                runs.map((run) => {
                  const result = resultsByRunId.get(run.id);
                  return (
                    <tr key={run.id}>
                      <td className="px-3 py-3 text-sm text-secondary">
                        <div className="font-medium text-[color:var(--text-primary)]">
                          {simulationNameById.get(run.policy_simulation_id) ?? run.policy_simulation_id}
                        </div>
                        <div className="text-xs text-muted">{run.created_at.toLocaleString("en-NZ")}</div>
                      </td>
                      <td className="px-3 py-3 text-sm text-secondary">{run.status}</td>
                      <td className="px-3 py-3 text-sm text-secondary">
                        {result ? result.blocked_entries_estimate : "-"}
                      </td>
                      <td className="px-3 py-3 text-sm text-secondary">
                        {result ? result.approval_load_estimate : "-"}
                      </td>
                      <td className="px-3 py-3 text-sm text-secondary">
                        {result ? result.false_positive_estimate : "-"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {result ? (
                          <Link
                            href={`/api/policy-simulator/runs/${run.id}/export`}
                            className="btn-secondary min-h-[30px] px-2 py-1 text-xs"
                          >
                            Download JSON
                          </Link>
                        ) : (
                          <span className="text-xs text-muted">Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

