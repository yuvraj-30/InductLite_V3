import { scopedDb } from "@/lib/db/scoped-db";
import { countGlobalIdentityOcrVerifications } from "@/lib/db/scoped";
import type { IdentityOcrStatus, IdentityOcrVerification } from "@prisma/client";
import { handlePrismaError, RepositoryError, requireCompanyId } from "./base";

export interface CreateIdentityOcrVerificationInput {
  site_id: string;
  sign_in_record_id?: string | null;
  identity_verification_record_id?: string | null;
  provider: string;
  document_type?: string | null;
  decision_mode: "assist" | "strict";
  decision_status: IdentityOcrStatus;
  confidence_score?: number | null;
  name_match_score?: number | null;
  extracted_name?: string | null;
  extracted_document_number_hash?: string | null;
  extracted_expiry_date?: Date | null;
  reason_code?: string | null;
  request_metadata?: Record<string, unknown> | null;
  response_metadata?: Record<string, unknown> | null;
}

export interface ListIdentityOcrVerificationFilter {
  site_id?: string;
  decision_status?: IdentityOcrStatus;
  sign_in_record_id?: string;
  limit?: number;
}

interface IdentityOcrDbDelegate {
  identityOcrVerification: {
    create: (args: Record<string, unknown>) => Promise<IdentityOcrVerification>;
    findMany: (args: Record<string, unknown>) => Promise<IdentityOcrVerification[]>;
    count: (args: Record<string, unknown>) => Promise<number>;
  };
}

function getIdentityOcrDb(companyId: string): IdentityOcrDbDelegate {
  return scopedDb(companyId) as unknown as IdentityOcrDbDelegate;
}

export async function createIdentityOcrVerification(
  companyId: string,
  input: CreateIdentityOcrVerificationInput,
): Promise<IdentityOcrVerification> {
  requireCompanyId(companyId);
  if (!input.site_id.trim()) {
    throw new RepositoryError("site_id is required", "VALIDATION");
  }
  if (!input.provider.trim()) {
    throw new RepositoryError("provider is required", "VALIDATION");
  }

  const db = getIdentityOcrDb(companyId);
  try {
    return await db.identityOcrVerification.create({
      data: {
        site_id: input.site_id.trim(),
        sign_in_record_id: input.sign_in_record_id?.trim() || null,
        identity_verification_record_id:
          input.identity_verification_record_id?.trim() || null,
        provider: input.provider.trim().slice(0, 80),
        document_type: input.document_type?.trim() || null,
        decision_mode: input.decision_mode,
        decision_status: input.decision_status,
        confidence_score: input.confidence_score ?? null,
        name_match_score: input.name_match_score ?? null,
        extracted_name: input.extracted_name?.trim() || null,
        extracted_document_number_hash:
          input.extracted_document_number_hash?.trim() || null,
        extracted_expiry_date: input.extracted_expiry_date ?? null,
        reason_code: input.reason_code?.trim() || null,
        request_metadata: input.request_metadata ?? null,
        response_metadata: input.response_metadata ?? null,
      },
    });
  } catch (error) {
    handlePrismaError(error, "IdentityOcrVerification");
  }
}

export async function listIdentityOcrVerifications(
  companyId: string,
  filter?: ListIdentityOcrVerificationFilter,
): Promise<IdentityOcrVerification[]> {
  requireCompanyId(companyId);
  const limit = Math.max(1, Math.min(filter?.limit ?? 200, 1000));

  const db = getIdentityOcrDb(companyId);
  try {
    return await db.identityOcrVerification.findMany({
      where: {
        ...(filter?.site_id ? { site_id: filter.site_id } : {}),
        ...(filter?.decision_status
          ? { decision_status: filter.decision_status }
          : {}),
        ...(filter?.sign_in_record_id
          ? { sign_in_record_id: filter.sign_in_record_id }
          : {}),
      },
      orderBy: [{ created_at: "desc" }],
      take: limit,
    });
  } catch (error) {
    handlePrismaError(error, "IdentityOcrVerification");
  }
}

export async function countIdentityOcrVerificationsSince(
  companyId: string,
  input: {
    since: Date;
    site_id?: string;
  },
): Promise<number> {
  requireCompanyId(companyId);

  const db = getIdentityOcrDb(companyId);
  try {
    return await db.identityOcrVerification.count({
      where: {
        created_at: { gte: input.since },
        ...(input.site_id ? { site_id: input.site_id } : {}),
      },
    });
  } catch (error) {
    handlePrismaError(error, "IdentityOcrVerification");
  }
}

export async function countGlobalIdentityOcrVerificationsSince(
  since: Date,
): Promise<number> {
  try {
    return await countGlobalIdentityOcrVerifications(since);
  } catch (error) {
    handlePrismaError(error, "IdentityOcrVerification");
  }
}
