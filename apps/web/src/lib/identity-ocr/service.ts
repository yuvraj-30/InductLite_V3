import { createHash } from "crypto";
import type { IdentityOcrStatus } from "@prisma/client";
import { guardrailDeniedResponse, type ApiErrorResponse } from "@/lib/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { GUARDRAILS } from "@/lib/guardrails";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import {
  countGlobalIdentityOcrVerificationsSince,
  countIdentityOcrVerificationsSince,
  createIdentityOcrVerification,
} from "@/lib/repository/identity-ocr.repository";
import { resolveIdentityOcrProvider } from "./providers";
import type { IdentityOcrDecisionMode } from "./providers/base";

export interface RunIdentityOcrVerificationInput {
  companyId: string;
  siteId: string;
  signInRecordId?: string;
  visitorName: string;
  documentImageDataUrl: string;
  documentType?: string | null;
  allowedDocumentTypes?: string[];
  decisionMode: IdentityOcrDecisionMode;
}

export interface RunIdentityOcrVerificationResult {
  executed: boolean;
  decisionStatus: IdentityOcrStatus | null;
  reasonCode: string | null;
  controlError?: ApiErrorResponse;
  skippedReason?: string;
}

function isOcrEnabledByEnv(): boolean {
  return process.env.OCR_ENABLED === "true" || process.env.OCR_ENABLED === "1";
}

function monthStartUtc(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function dayStartUtc(date = new Date()): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

function hashDocumentNumber(value: string | null): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

export async function runIdentityOcrVerification(
  input: RunIdentityOcrVerificationInput,
): Promise<RunIdentityOcrVerificationResult> {
  if (!isFeatureEnabled("IDENTITY_OCR_V1")) {
    return {
      executed: false,
      decisionStatus: null,
      reasonCode: null,
      skippedReason: "OCR_ROLLOUT_FLAG_DISABLED",
    };
  }

  if (!isOcrEnabledByEnv()) {
    return {
      executed: false,
      decisionStatus: null,
      reasonCode: null,
      skippedReason: "OCR_ENV_DISABLED",
    };
  }

  try {
    await assertCompanyFeatureEnabled(
      input.companyId,
      "ID_OCR_VERIFICATION_V1",
      input.siteId,
    );
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return {
        executed: false,
        decisionStatus: null,
        reasonCode: null,
        skippedReason: "OCR_PLAN_ENTITLEMENT_DISABLED",
      };
    }
    throw error;
  }

  const companyCap = Math.max(
    0,
    GUARDRAILS.MAX_OCR_REQUESTS_PER_COMPANY_PER_MONTH,
  );
  if (companyCap > 0) {
    const used = await countIdentityOcrVerificationsSince(input.companyId, {
      since: monthStartUtc(),
      site_id: undefined,
    });
    if (used >= companyCap) {
      return {
        executed: false,
        decisionStatus: null,
        reasonCode: "OCR_COMPANY_QUOTA_EXCEEDED",
        controlError: guardrailDeniedResponse(
          "OCR-GUARDRAIL-001",
          `MAX_OCR_REQUESTS_PER_COMPANY_PER_MONTH=${companyCap}`,
          "tenant",
          "OCR monthly request limit reached",
        ),
      };
    }
  }

  const globalCap = Math.max(0, GUARDRAILS.MAX_OCR_REQUESTS_GLOBAL_PER_DAY);
  if (globalCap > 0) {
    const globalUsed = await countGlobalIdentityOcrVerificationsSince(dayStartUtc());
    if (globalUsed >= globalCap) {
      return {
        executed: false,
        decisionStatus: null,
        reasonCode: "OCR_GLOBAL_QUOTA_EXCEEDED",
        controlError: guardrailDeniedResponse(
          "OCR-GUARDRAIL-002",
          `MAX_OCR_REQUESTS_GLOBAL_PER_DAY=${globalCap}`,
          "environment",
          "OCR global daily limit reached",
        ),
      };
    }
  }

  const provider = await resolveIdentityOcrProvider(input.companyId);

  try {
    const providerResult = await provider.verify({
      companyId: input.companyId,
      siteId: input.siteId,
      visitorName: input.visitorName,
      documentImageDataUrl: input.documentImageDataUrl,
      documentType: input.documentType,
      allowedDocumentTypes: input.allowedDocumentTypes,
      decisionMode: input.decisionMode,
    });

    await createIdentityOcrVerification(input.companyId, {
      site_id: input.siteId,
      sign_in_record_id: input.signInRecordId ?? null,
      provider: providerResult.provider,
      document_type: input.documentType ?? null,
      decision_mode: input.decisionMode,
      decision_status: providerResult.decisionStatus,
      confidence_score: providerResult.confidenceScore,
      name_match_score: providerResult.nameMatchScore,
      extracted_name: providerResult.extractedName,
      extracted_document_number_hash: hashDocumentNumber(
        providerResult.extractedDocumentNumber,
      ),
      extracted_expiry_date: providerResult.extractedExpiryDate,
      reason_code: providerResult.reasonCode,
      request_metadata: {
        allowedDocumentTypes: input.allowedDocumentTypes ?? [],
      },
      response_metadata: providerResult.metadata,
    });

    return {
      executed: true,
      decisionStatus: providerResult.decisionStatus,
      reasonCode: providerResult.reasonCode,
    };
  } catch {
    await createIdentityOcrVerification(input.companyId, {
      site_id: input.siteId,
      sign_in_record_id: input.signInRecordId ?? null,
      provider: provider.key,
      document_type: input.documentType ?? null,
      decision_mode: input.decisionMode,
      decision_status: "ERROR",
      reason_code: "PROVIDER_UNAVAILABLE",
      request_metadata: {
        allowedDocumentTypes: input.allowedDocumentTypes ?? [],
      },
      response_metadata: null,
    });

    return {
      executed: true,
      decisionStatus: "ERROR",
      reasonCode: "PROVIDER_UNAVAILABLE",
    };
  }
}
