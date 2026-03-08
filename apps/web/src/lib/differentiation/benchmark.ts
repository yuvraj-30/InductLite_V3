import type { UserRole } from "@prisma/client";
import { getDashboardMetrics } from "@/lib/repository/dashboard.repository";
import { listSignInHistory } from "@/lib/repository/signin.repository";
import { listPermitRequests } from "@/lib/repository/permit.repository";
import { listContractorRiskScores } from "@/lib/repository/risk-passport.repository";

export interface BenchmarkCard {
  metricKey: string;
  label: string;
  currentValue: number;
  projected30d: number;
  percentile: number;
  explanation: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function percentileFromTarget(value: number, target: number, tolerance: number): number {
  if (tolerance <= 0) return 50;
  const delta = value - target;
  const normalized = 50 + (delta / tolerance) * 50;
  return clamp(normalized, 1, 99);
}

export async function buildPredictiveBenchmarkCards(input: {
  companyId: string;
  userId: string;
  userRole: UserRole;
}): Promise<BenchmarkCard[]> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [dashboard, previousWeekSignIns, permits, riskScores] = await Promise.all([
    getDashboardMetrics(input.companyId, {
      userId: input.userId,
      userRole: input.userRole,
    }),
    listSignInHistory(
      input.companyId,
      {
        dateRange: {
          from: fourteenDaysAgo,
          to: sevenDaysAgo,
        },
      },
      { page: 1, pageSize: 1 },
    ),
    listPermitRequests(input.companyId),
    listContractorRiskScores(input.companyId, { limit: 1000 }),
  ]);

  const signInsCurrent = dashboard.signInsSevenDays;
  const signInsPrev = previousWeekSignIns.total;
  const signInsTrend = signInsCurrent - signInsPrev;
  const signInsProjected30d = Math.max(0, Math.round(signInsCurrent * 4 + signInsTrend * 2));

  const permitTotal = permits.length;
  const permitApproved = permits.filter((permit) =>
    ["APPROVED", "ACTIVE", "CLOSED"].includes(permit.status),
  ).length;
  const permitApprovalRate = permitTotal > 0 ? (permitApproved / permitTotal) * 100 : 0;
  const permitProjected30d = clamp(permitApprovalRate + 2, 0, 100);

  const riskTotal = riskScores.length;
  const riskLow = riskScores.filter((score) => score.threshold_state === "LOW").length;
  const lowRiskCoverage = riskTotal > 0 ? (riskLow / riskTotal) * 100 : 0;
  const lowRiskProjected30d = clamp(
    lowRiskCoverage + (dashboard.quizSummary.passRatePercent >= 85 ? 3 : -2),
    0,
    100,
  );

  const inductionPassRate = dashboard.quizSummary.passRatePercent;
  const inductionProjected30d = clamp(
    inductionPassRate + (dashboard.quizSummary.failedResponses30Days > 20 ? -4 : 2),
    0,
    100,
  );

  return [
    {
      metricKey: "signins_7d",
      label: "Visitor Throughput (7d)",
      currentValue: signInsCurrent,
      projected30d: signInsProjected30d,
      percentile: percentileFromTarget(signInsCurrent, 150, 120),
      explanation:
        "Projection uses current 7-day throughput and prior-week delta to estimate next 30 days.",
    },
    {
      metricKey: "permit_approval_rate",
      label: "Permit Approval Rate",
      currentValue: Math.round(permitApprovalRate),
      projected30d: permitProjected30d,
      percentile: percentileFromTarget(permitApprovalRate, 82, 18),
      explanation:
        "Higher approval rates indicate faster permit operations; projection assumes incremental process cleanup.",
    },
    {
      metricKey: "low_risk_coverage",
      label: "Low-Risk Contractor Coverage",
      currentValue: Math.round(lowRiskCoverage),
      projected30d: lowRiskProjected30d,
      percentile: percentileFromTarget(lowRiskCoverage, 70, 20),
      explanation:
        "Combines current contractor risk states with quiz performance pressure to forecast near-term risk posture.",
    },
    {
      metricKey: "induction_pass_rate",
      label: "Induction Pass Rate",
      currentValue: inductionPassRate,
      projected30d: inductionProjected30d,
      percentile: percentileFromTarget(inductionPassRate, 88, 12),
      explanation:
        "Uses scored induction outcomes and current failure pressure to estimate next-month performance.",
    },
  ];
}
