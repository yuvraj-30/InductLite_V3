import { listCommunicationEvents } from "@/lib/repository/communication.repository";

export interface SafetyCopilotWeeklyReport {
  windowStart: Date;
  windowEnd: Date;
  runs: number;
  recommendationTotal: number;
  decisionTotal: number;
  accepted: number;
  rejected: number;
  edited: number;
  acceptanceRate: number;
  rejectionRate: number;
  editRate: number;
  decisionCoverageRate: number;
  highConfidenceAccepted: number;
  mediumConfidenceAccepted: number;
  lowConfidenceAccepted: number;
  outcomeDelta: {
    openPermits: number;
    openHazards: number;
    openIncidents: number;
    prequalPending: number;
    highRiskProfiles: number;
  } | null;
}

interface CopilotSignals {
  openPermits: number;
  openHazards: number;
  openIncidents: number;
  prequalPending: number;
  highRiskProfiles: number;
}

function parsePayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function parseSignals(value: unknown): CopilotSignals {
  const row = parsePayload(value);
  const openPermits = typeof row.openPermits === "number" ? row.openPermits : 0;
  const openHazards = typeof row.openHazards === "number" ? row.openHazards : 0;
  const openIncidents = typeof row.openIncidents === "number" ? row.openIncidents : 0;
  const prequalPending = typeof row.prequalPending === "number" ? row.prequalPending : 0;
  const highRiskProfiles =
    typeof row.highRiskProfiles === "number" ? row.highRiskProfiles : 0;

  return {
    openPermits,
    openHazards,
    openIncidents,
    prequalPending,
    highRiskProfiles,
  };
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}

export async function buildSafetyCopilotWeeklyReport(input: {
  companyId: string;
  siteId?: string;
  now?: Date;
  days?: number;
}): Promise<SafetyCopilotWeeklyReport> {
  const windowEnd = input.now ?? new Date();
  const days = Math.max(1, Math.min(input.days ?? 7, 31));
  const windowStart = new Date(windowEnd.getTime() - days * 24 * 60 * 60 * 1000);

  const [runEvents, decisionEvents] = await Promise.all([
    listCommunicationEvents(input.companyId, {
      site_id: input.siteId,
      event_type: "ai.copilot.run",
      created_at_from: windowStart,
      created_at_to: windowEnd,
      limit: 500,
    }),
    listCommunicationEvents(input.companyId, {
      site_id: input.siteId,
      event_type: "ai.copilot.decision",
      created_at_from: windowStart,
      created_at_to: windowEnd,
      limit: 2000,
    }),
  ]);

  const accepted = decisionEvents.filter((event) => event.status === "ACCEPTED").length;
  const rejected = decisionEvents.filter((event) => event.status === "REJECTED").length;
  const edited = decisionEvents.filter((event) => event.status === "EDITED").length;
  const decisionTotal = accepted + rejected + edited;

  let recommendationTotal = 0;
  const orderedRunEvents = [...runEvents].sort(
    (a, b) => a.created_at.getTime() - b.created_at.getTime(),
  );
  for (const runEvent of orderedRunEvents) {
    const payload = parsePayload(runEvent.payload);
    const recommendations = Array.isArray(payload.recommendations)
      ? payload.recommendations
      : [];
    recommendationTotal += recommendations.length;
  }

  let highConfidenceAccepted = 0;
  let mediumConfidenceAccepted = 0;
  let lowConfidenceAccepted = 0;
  for (const decisionEvent of decisionEvents) {
    if (decisionEvent.status !== "ACCEPTED") continue;
    const payload = parsePayload(decisionEvent.payload);
    const confidenceBand =
      typeof payload.confidence_band === "string"
        ? payload.confidence_band
        : "low";
    if (confidenceBand === "high") {
      highConfidenceAccepted += 1;
      continue;
    }
    if (confidenceBand === "medium") {
      mediumConfidenceAccepted += 1;
      continue;
    }
    lowConfidenceAccepted += 1;
  }

  let outcomeDelta: SafetyCopilotWeeklyReport["outcomeDelta"] = null;
  const firstRunEvent = orderedRunEvents.at(0);
  const lastRunEvent = orderedRunEvents.at(-1);
  if (orderedRunEvents.length >= 2 && firstRunEvent && lastRunEvent) {
    const firstPayload = parsePayload(firstRunEvent.payload);
    const lastPayload = parsePayload(lastRunEvent.payload);
    const firstSignals = parseSignals(firstPayload.signals);
    const lastSignals = parseSignals(lastPayload.signals);
    outcomeDelta = {
      openPermits: lastSignals.openPermits - firstSignals.openPermits,
      openHazards: lastSignals.openHazards - firstSignals.openHazards,
      openIncidents: lastSignals.openIncidents - firstSignals.openIncidents,
      prequalPending: lastSignals.prequalPending - firstSignals.prequalPending,
      highRiskProfiles: lastSignals.highRiskProfiles - firstSignals.highRiskProfiles,
    };
  }

  return {
    windowStart,
    windowEnd,
    runs: runEvents.length,
    recommendationTotal,
    decisionTotal,
    accepted,
    rejected,
    edited,
    acceptanceRate: safeRate(accepted, decisionTotal),
    rejectionRate: safeRate(rejected, decisionTotal),
    editRate: safeRate(edited, decisionTotal),
    decisionCoverageRate: safeRate(decisionTotal, recommendationTotal),
    highConfidenceAccepted,
    mediumConfidenceAccepted,
    lowConfidenceAccepted,
    outcomeDelta,
  };
}
