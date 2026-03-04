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
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Safety Policy Simulator</h1>
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Policy simulator is disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001).
        </p>
      </div>
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "POLICY_SIMULATOR_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">Safety Policy Simulator</h1>
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Policy simulator is not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001).
          </p>
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
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Safety Policy Simulator</h1>
        <p className="mt-1 text-sm text-gray-600">
          Build policy scenarios and replay them against historical data to estimate operational impact.
        </p>
      </div>

      {params.message ? (
        <div className={`rounded-lg border p-3 text-sm ${statusBannerClass(params.status)}`}>
          {params.message}
        </div>
      ) : null}

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Create Scenario
        </h2>
        <form action={createPolicySimulationAction} className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-sm text-gray-700">
            Scenario Name
            <input
              name="name"
              className="input mt-1"
              placeholder="After-hours tightening scenario"
              required
            />
          </label>
          <label className="text-sm text-gray-700">
            Lookback Days
            <input name="lookbackDays" type="number" min={1} max={365} defaultValue={30} className="input mt-1" />
          </label>
          <label className="text-sm text-gray-700">
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
          <label className="text-sm text-gray-700">
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
          <label className="flex items-center gap-2 self-end text-sm text-gray-700">
            <input name="permitRequired" type="checkbox" className="h-4 w-4" />
            Assume permit required at sign-in
          </label>
          <div className="md:col-span-3">
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Save Scenario
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Scenarios
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Name</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Created</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Scenario</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {simulations.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-sm text-gray-500">No simulation scenarios created yet.</td>
                </tr>
              ) : (
                simulations.map((simulation) => (
                  <tr key={simulation.id}>
                    <td className="px-3 py-3 text-sm font-medium text-gray-900">{simulation.name}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {simulation.created_at.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600">
                      <code className="inline-block max-w-[28rem] truncate rounded bg-gray-100 px-1 py-0.5">
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

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Recent Runs
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Run</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Blocked Est.</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Approval Load</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">False Positives</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-sm text-gray-500">No simulation runs yet.</td>
                </tr>
              ) : (
                runs.map((run) => {
                  const result = resultsByRunId.get(run.id);
                  return (
                    <tr key={run.id}>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        <div className="font-medium text-gray-900">
                          {simulationNameById.get(run.policy_simulation_id) ?? run.policy_simulation_id}
                        </div>
                        <div className="text-xs text-gray-500">{run.created_at.toLocaleString("en-NZ")}</div>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">{run.status}</td>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        {result ? result.blocked_entries_estimate : "-"}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        {result ? result.approval_load_estimate : "-"}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        {result ? result.false_positive_estimate : "-"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {result ? (
                          <Link
                            href={`/api/policy-simulator/runs/${run.id}/export`}
                            className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Download JSON
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-500">Pending</span>
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
