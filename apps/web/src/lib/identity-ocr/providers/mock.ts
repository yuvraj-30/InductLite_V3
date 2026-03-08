import { createHash } from "crypto";
import type {
  IdentityOcrProvider,
  IdentityOcrProviderInput,
  IdentityOcrProviderResult,
} from "./base";

function toScore(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function hashShort(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

export class MockIdentityOcrProvider implements IdentityOcrProvider {
  key = "MOCK";

  async verify(
    input: IdentityOcrProviderInput,
  ): Promise<IdentityOcrProviderResult> {
    const normalizedType = input.documentType?.trim().toUpperCase() || null;
    const allowedTypes = (input.allowedDocumentTypes ?? []).map((item) =>
      item.trim().toUpperCase(),
    );

    if (normalizedType && allowedTypes.length > 0 && !allowedTypes.includes(normalizedType)) {
      return {
        provider: this.key,
        decisionStatus: "REJECTED",
        confidenceScore: 0.25,
        nameMatchScore: 0.2,
        extractedName: null,
        extractedDocumentNumber: null,
        extractedExpiryDate: null,
        reasonCode: "DOCUMENT_TYPE_NOT_ALLOWED",
        metadata: {
          documentType: normalizedType,
          allowedDocumentTypes: allowedTypes,
        },
      };
    }

    const payload = input.documentImageDataUrl;
    if (payload.toLowerCase().includes("reject")) {
      return {
        provider: this.key,
        decisionStatus: "REJECTED",
        confidenceScore: 0.32,
        nameMatchScore: 0.31,
        extractedName: null,
        extractedDocumentNumber: `MOCK-${hashShort(payload)}`,
        extractedExpiryDate: null,
        reasonCode: "OCR_RULE_REJECT_PATTERN",
        metadata: {
          payloadLength: payload.length,
        },
      };
    }

    const dynamic = (payload.length % 35) / 100;
    const confidence = toScore(0.62 + dynamic);
    const nameMatch = toScore(0.75 + dynamic / 2);
    const status =
      input.decisionMode === "strict" && confidence < 0.8 ? "REVIEW" : "APPROVED";

    return {
      provider: this.key,
      decisionStatus: status,
      confidenceScore: confidence,
      nameMatchScore: nameMatch,
      extractedName: input.visitorName.trim() || null,
      extractedDocumentNumber: `MOCK-${hashShort(payload)}`,
      extractedExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      reasonCode: status === "APPROVED" ? "OCR_CONFIDENCE_PASS" : "OCR_CONFIDENCE_REVIEW",
      metadata: {
        payloadLength: payload.length,
        decisionMode: input.decisionMode,
      },
    };
  }
}
