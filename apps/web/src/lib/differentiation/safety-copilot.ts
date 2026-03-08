import { listPermitRequests } from "@/lib/repository/permit.repository";
import { listHazards } from "@/lib/repository/hazard.repository";
import { listIncidentReports } from "@/lib/repository/incident.repository";
import { listContractorPrequalifications } from "@/lib/repository/permit.repository";
import { listContractorRiskScores } from "@/lib/repository/risk-passport.repository";

export interface SafetyCopilotResponse {
  summary: string;
  recommendations: Array<{
    title: string;
    reason: string;
    severity: "low" | "medium" | "high";
  }>;
  signals: {
    openPermits: number;
    openHazards: number;
    openIncidents: number;
    prequalPending: number;
    highRiskProfiles: number;
  };
}

function summarizeSeverity(input: {
  openHazards: number;
  openIncidents: number;
  highRiskProfiles: number;
}): "low" | "medium" | "high" {
  if (
    input.openHazards >= 10 ||
    input.openIncidents >= 5 ||
    input.highRiskProfiles >= 8
  ) {
    return "high";
  }
  if (
    input.openHazards >= 4 ||
    input.openIncidents >= 2 ||
    input.highRiskProfiles >= 3
  ) {
    return "medium";
  }
  return "low";
}

export async function generateSafetyCopilotResponse(input: {
  companyId: string;
  siteId?: string;
  prompt: string;
}): Promise<SafetyCopilotResponse> {
  const [permits, hazards, incidents, prequals, riskScores] = await Promise.all([
    listPermitRequests(input.companyId, input.siteId ? { site_id: input.siteId } : {}),
    listHazards(
      input.companyId,
      {
        ...(input.siteId ? { site_id: input.siteId } : {}),
        status: ["OPEN", "IN_PROGRESS"],
      },
      { page: 1, pageSize: 500 },
    ),
    listIncidentReports(
      input.companyId,
      {
        ...(input.siteId ? { site_id: input.siteId } : {}),
        status: ["OPEN", "INVESTIGATING"],
      },
      { page: 1, pageSize: 500 },
    ),
    listContractorPrequalifications(
      input.companyId,
      input.siteId ? { site_id: input.siteId } : {},
    ),
    listContractorRiskScores(
      input.companyId,
      input.siteId ? { site_id: input.siteId, limit: 1000 } : { limit: 1000 },
    ),
  ]);

  const signals = {
    openPermits: permits.filter((permit) =>
      ["REQUESTED", "APPROVED", "ACTIVE", "SUSPENDED"].includes(permit.status),
    ).length,
    openHazards: hazards.items.length,
    openIncidents: incidents.items.length,
    prequalPending: prequals.filter((prequal) => prequal.status === "PENDING").length,
    highRiskProfiles: riskScores.filter((score) => score.threshold_state === "HIGH").length,
  };

  const recommendations: SafetyCopilotResponse["recommendations"] = [];
  if (signals.highRiskProfiles > 0) {
    recommendations.push({
      title: "Prioritize high-risk contractor reviews",
      reason: `${signals.highRiskProfiles} contractor profile(s) are currently in HIGH threshold state.`,
      severity: "high",
    });
  }
  if (signals.prequalPending > 0) {
    recommendations.push({
      title: "Clear pending prequalification queue",
      reason: `${signals.prequalPending} contractor prequalification record(s) are pending review.`,
      severity: signals.prequalPending >= 5 ? "high" : "medium",
    });
  }
  if (signals.openHazards > 0) {
    recommendations.push({
      title: "Close aging hazard controls",
      reason: `${signals.openHazards} hazard record(s) are still open/monitoring.`,
      severity: signals.openHazards >= 10 ? "high" : "medium",
    });
  }
  if (signals.openIncidents > 0) {
    recommendations.push({
      title: "Finish incident investigations",
      reason: `${signals.openIncidents} incident record(s) are open or investigating.`,
      severity: signals.openIncidents >= 4 ? "high" : "medium",
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      title: "Maintain current controls",
      reason: "No immediate high-risk safety backlog was detected in current operational signals.",
      severity: "low",
    });
  }

  const overallSeverity = summarizeSeverity({
    openHazards: signals.openHazards,
    openIncidents: signals.openIncidents,
    highRiskProfiles: signals.highRiskProfiles,
  });

  const summary =
    `Prompt: ${input.prompt.trim().slice(0, 220)}\n` +
    `Current posture: ${overallSeverity.toUpperCase()}.\n` +
    `Signals -> permits:${signals.openPermits}, hazards:${signals.openHazards}, incidents:${signals.openIncidents}, prequal pending:${signals.prequalPending}, high risk:${signals.highRiskProfiles}.`;

  return { summary, recommendations, signals };
}
