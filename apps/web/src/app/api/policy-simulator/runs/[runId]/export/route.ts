import { NextResponse } from "next/server";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import {
  findPolicySimulationById,
  findPolicySimulationResultByRunId,
  findPolicySimulationRunById,
} from "@/lib/repository/policy-simulator.repository";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    return NextResponse.json(
      { success: false, error: guard.error },
      { status: guard.code === "FORBIDDEN" ? 403 : 401 },
    );
  }

  if (!isFeatureEnabled("POLICY_SIMULATOR_V1")) {
    return NextResponse.json(
      {
        success: false,
        error: "Policy simulator export is disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001)",
      },
      { status: 403 },
    );
  }

  try {
    await assertCompanyFeatureEnabled(guard.user.companyId, "POLICY_SIMULATOR_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Policy simulator export is not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
        },
        { status: 403 },
      );
    }
    throw error;
  }

  const { runId } = await params;
  const run = await findPolicySimulationRunById(guard.user.companyId, runId);
  if (!run) {
    return NextResponse.json(
      { success: false, error: "Simulation run not found" },
      { status: 404 },
    );
  }

  const result = await findPolicySimulationResultByRunId(guard.user.companyId, run.id);
  if (!result) {
    return NextResponse.json(
      { success: false, error: "Simulation result not found" },
      { status: 404 },
    );
  }

  const simulation = await findPolicySimulationById(
    guard.user.companyId,
    run.policy_simulation_id,
  );

  const exportPayload = {
    exported_at: new Date().toISOString(),
    run: {
      id: run.id,
      status: run.status,
      created_at: run.created_at.toISOString(),
      started_at: run.started_at?.toISOString() ?? null,
      completed_at: run.completed_at?.toISOString() ?? null,
      requested_by: run.requested_by,
    },
    simulation: simulation
      ? {
          id: simulation.id,
          name: simulation.name,
          scenario: simulation.scenario,
          created_at: simulation.created_at.toISOString(),
        }
      : null,
    result: {
      blocked_entries_estimate: result.blocked_entries_estimate,
      approval_load_estimate: result.approval_load_estimate,
      false_positive_estimate: result.false_positive_estimate,
      summary: result.summary,
      breakdown: result.breakdown,
      created_at: result.created_at.toISOString(),
    },
  };

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="policy-simulation-${run.id}.json"`,
      "cache-control": "no-store",
    },
  });
}
