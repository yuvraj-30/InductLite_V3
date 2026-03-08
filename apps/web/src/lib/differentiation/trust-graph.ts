import { listContractors } from "@/lib/repository/contractor.repository";
import { listContractorPrequalifications } from "@/lib/repository/permit.repository";
import { listContractorRiskScores } from "@/lib/repository/risk-passport.repository";

export interface ContractorTrustNode {
  contractorId: string;
  contractorName: string;
  siteId: string | null;
  trustScore: number;
  confidence: number;
  reasons: string[];
  components: {
    internalRiskScore: number | null;
    externalPrequalScore: number | null;
    prequalStatus: string | null;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function prequalStatusScore(status: string | null): number {
  if (!status) return 55;
  if (status === "APPROVED") return 85;
  if (status === "PENDING") return 60;
  if (status === "EXPIRED") return 35;
  return 20;
}

export async function buildContractorTrustGraph(input: {
  companyId: string;
  siteId?: string;
}): Promise<ContractorTrustNode[]> {
  const [contractorsPage, prequals, riskScores] = await Promise.all([
    listContractors(input.companyId, { isActive: true }, { page: 1, pageSize: 1000 }),
    listContractorPrequalifications(
      input.companyId,
      input.siteId ? { site_id: input.siteId } : {},
    ),
    listContractorRiskScores(
      input.companyId,
      input.siteId ? { site_id: input.siteId, limit: 1000 } : { limit: 1000 },
    ),
  ]);

  const contractors = contractorsPage.items;
  const riskByContractor = new Map(
    riskScores.map((score) => [score.contractor_id, score]),
  );
  const prequalByContractor = new Map<string, (typeof prequals)[number]>();
  for (const prequal of prequals) {
    const existing = prequalByContractor.get(prequal.contractor_id);
    if (!existing || existing.updated_at < prequal.updated_at) {
      prequalByContractor.set(prequal.contractor_id, prequal);
    }
  }

  return contractors
    .map((contractor) => {
      const risk = riskByContractor.get(contractor.id) ?? null;
      const prequal = prequalByContractor.get(contractor.id) ?? null;
      const internalRiskScore = risk?.current_score ?? null;
      const externalPrequalScore =
        prequal?.score && Number.isFinite(prequal.score) ? prequal.score : null;
      const prequalStatus = prequal?.status ?? null;
      const baseRiskScore = internalRiskScore ?? 55;
      const basePrequalScore = externalPrequalScore ?? prequalStatusScore(prequalStatus);

      const trustScore = clamp(baseRiskScore * 0.7 + basePrequalScore * 0.3, 0, 100);
      const confidence = clamp(
        35 +
          (internalRiskScore !== null ? 35 : 0) +
          (prequal ? 20 : 0) +
          (prequal?.evidence_refs ? 10 : 0),
        0,
        100,
      );

      const reasons: string[] = [];
      if (internalRiskScore !== null) {
        reasons.push(`Internal risk score ${internalRiskScore}`);
      } else {
        reasons.push("Internal risk score missing");
      }

      if (prequalStatus) {
        reasons.push(`External prequalification status ${prequalStatus}`);
      } else {
        reasons.push("No external prequalification feed");
      }

      if (prequal?.evidence_refs) {
        const provider =
          typeof (prequal.evidence_refs as Record<string, unknown>).provider === "string"
            ? ((prequal.evidence_refs as Record<string, unknown>).provider as string)
            : null;
        if (provider) {
          reasons.push(`External provider ${provider}`);
        }
      }

      return {
        contractorId: contractor.id,
        contractorName: contractor.name,
        siteId: input.siteId ?? prequal?.site_id ?? risk?.site_id ?? null,
        trustScore,
        confidence,
        reasons,
        components: {
          internalRiskScore,
          externalPrequalScore,
          prequalStatus,
        },
      };
    })
    .sort((left, right) => {
      if (left.trustScore !== right.trustScore) {
        return left.trustScore - right.trustScore;
      }
      return left.contractorName.localeCompare(right.contractorName);
    });
}
