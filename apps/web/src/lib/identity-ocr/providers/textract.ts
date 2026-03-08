import { AnalyzeIDCommand, TextractClient } from "@aws-sdk/client-textract";
import type {
  IdentityOcrProvider,
  IdentityOcrProviderInput,
  IdentityOcrProviderResult,
} from "./base";

const strictConfidenceThreshold = 0.85;
const strictNameMatchThreshold = 0.7;
const assistConfidenceThreshold = 0.55;
const assistNameMatchThreshold = 0.45;

interface TextractIdentityOcrProviderOptions {
  providerKey: string;
  region: string;
}

interface CandidateField {
  text: string | null;
  confidence: number | null;
}

type IdField = {
  Type?: { Text?: string | null } | null;
  ValueDetection?: { Text?: string | null; Confidence?: number | null } | null;
};

function normalizeDocType(value: string | null | undefined): string | null {
  const normalized = value
    ?.trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_-]/g, "");
  return normalized || null;
}

function parseDataUrlImageBytes(dataUrl: string): Uint8Array {
  const match = dataUrl.match(
    /^data:image\/(?:png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/i,
  );
  if (!match?.[1]) {
    throw new Error("Invalid OCR image payload");
  }
  return Buffer.from(match[1], "base64");
}

function parseFlexibleDate(value: string | null): Date | null {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const slash = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, dd, mm, yyyy] = slash;
    const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const dash = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dash) {
    const [, yyyy, mm, dd] = dash;
    const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function averageConfidence(values: Array<number | null | undefined>): number | null {
  const cleaned = values.filter((value): value is number => typeof value === "number");
  if (cleaned.length === 0) {
    return null;
  }
  const mean = cleaned.reduce((sum, value) => sum + value, 0) / cleaned.length;
  return Number((mean / 100).toFixed(2));
}

function tokenizeName(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function computeNameMatchScore(expectedName: string, extractedName: string | null): number | null {
  if (!expectedName.trim() || !extractedName?.trim()) {
    return null;
  }

  const expectedTokens = new Set(tokenizeName(expectedName));
  const extractedTokens = new Set(tokenizeName(extractedName));
  if (expectedTokens.size === 0 || extractedTokens.size === 0) {
    return null;
  }

  let overlap = 0;
  for (const token of expectedTokens) {
    if (extractedTokens.has(token)) {
      overlap += 1;
    }
  }
  const denominator = Math.max(expectedTokens.size, extractedTokens.size);
  return Number((overlap / denominator).toFixed(2));
}

function normalizeFieldType(value: string | null | undefined): string {
  return (
    value
      ?.trim()
      .toUpperCase()
      .replace(/\s+/g, "_")
      .replace(/[^A-Z0-9_]/g, "") || ""
  );
}

function pickField(fields: IdField[], candidateKeys: string[]): CandidateField {
  const wanted = new Set(candidateKeys.map((item) => item.toUpperCase()));
  for (const field of fields) {
    const type = normalizeFieldType(field.Type?.Text);
    if (!wanted.has(type)) {
      continue;
    }
    const text = field.ValueDetection?.Text?.trim() || null;
    const confidence = field.ValueDetection?.Confidence ?? null;
    return { text, confidence };
  }
  return { text: null, confidence: null };
}

function isExpired(date: Date | null): boolean {
  if (!date) return false;
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
  return date.getTime() < todayUtc.getTime();
}

export class TextractIdentityOcrProvider implements IdentityOcrProvider {
  readonly key: string;
  private readonly region: string;
  private readonly client: TextractClient;

  constructor(options: TextractIdentityOcrProviderOptions) {
    this.key = options.providerKey.trim().toUpperCase();
    this.region = options.region.trim();
    this.client = new TextractClient({
      region: this.region,
    });
  }

  async verify(
    input: IdentityOcrProviderInput,
  ): Promise<IdentityOcrProviderResult> {
    const normalizedInputType = normalizeDocType(input.documentType);
    const allowedDocTypes = new Set(
      (input.allowedDocumentTypes ?? [])
        .map((value) => normalizeDocType(value))
        .filter((value): value is string => Boolean(value)),
    );

    if (
      normalizedInputType &&
      allowedDocTypes.size > 0 &&
      !allowedDocTypes.has(normalizedInputType)
    ) {
      return {
        provider: this.key,
        decisionStatus: "REJECTED",
        confidenceScore: 0.2,
        nameMatchScore: 0.2,
        extractedName: null,
        extractedDocumentNumber: null,
        extractedExpiryDate: null,
        reasonCode: "DOCUMENT_TYPE_NOT_ALLOWED",
        metadata: {
          providerRegion: this.region,
          documentType: normalizedInputType,
          allowedDocumentTypes: Array.from(allowedDocTypes),
        },
      };
    }

    const imageBytes = parseDataUrlImageBytes(input.documentImageDataUrl);
    const response = await this.client.send(
      new AnalyzeIDCommand({
        DocumentPages: [
          {
            Bytes: imageBytes,
          },
        ],
      }),
    );

    const identityDocument = response.IdentityDocuments?.[0];
    const fields = (identityDocument?.IdentityDocumentFields ?? []) as IdField[];

    const firstName = pickField(fields, ["FIRST_NAME", "GIVEN_NAME"]);
    const lastName = pickField(fields, ["LAST_NAME", "SURNAME", "FAMILY_NAME"]);
    const fullName = pickField(fields, ["FULL_NAME", "NAME"]);
    const documentNumber = pickField(fields, [
      "DOCUMENT_NUMBER",
      "ID_NUMBER",
      "PASSPORT_NUMBER",
      "LICENCE_NUMBER",
      "LICENSE_NUMBER",
    ]);
    const documentType = pickField(fields, ["DOCUMENT_TYPE", "ID_TYPE", "TYPE"]);
    const expiryDate = pickField(fields, [
      "EXPIRATION_DATE",
      "EXPIRY_DATE",
      "DATE_OF_EXPIRY",
      "EXPIRATION",
      "EXPIRY",
    ]);

    const extractedName = (
      fullName.text ||
      `${firstName.text ?? ""} ${lastName.text ?? ""}`
    )
      .trim()
      .replace(/\s+/g, " ") || null;
    const extractedDocumentType = normalizeDocType(documentType.text);
    const extractedExpiryDate = parseFlexibleDate(expiryDate.text);
    const confidenceScore = averageConfidence([
      fullName.confidence,
      firstName.confidence,
      lastName.confidence,
      documentNumber.confidence,
      expiryDate.confidence,
    ]);
    const nameMatchScore = computeNameMatchScore(input.visitorName, extractedName);

    if (
      extractedDocumentType &&
      allowedDocTypes.size > 0 &&
      !allowedDocTypes.has(extractedDocumentType)
    ) {
      return {
        provider: this.key,
        decisionStatus: "REJECTED",
        confidenceScore,
        nameMatchScore,
        extractedName,
        extractedDocumentNumber: documentNumber.text,
        extractedExpiryDate,
        reasonCode: "DOCUMENT_TYPE_NOT_ALLOWED",
        metadata: {
          providerRegion: this.region,
          extractedDocumentType,
          allowedDocumentTypes: Array.from(allowedDocTypes),
          awsRequestId: response.$metadata.requestId ?? null,
        },
      };
    }

    if (isExpired(extractedExpiryDate)) {
      return {
        provider: this.key,
        decisionStatus: "REJECTED",
        confidenceScore,
        nameMatchScore,
        extractedName,
        extractedDocumentNumber: documentNumber.text,
        extractedExpiryDate,
        reasonCode: "DOCUMENT_EXPIRED",
        metadata: {
          providerRegion: this.region,
          extractedDocumentType,
          awsRequestId: response.$metadata.requestId ?? null,
        },
      };
    }

    const minimumConfidence =
      input.decisionMode === "strict"
        ? strictConfidenceThreshold
        : assistConfidenceThreshold;
    const minimumNameMatch =
      input.decisionMode === "strict"
        ? strictNameMatchThreshold
        : assistNameMatchThreshold;

    let decisionStatus: IdentityOcrProviderResult["decisionStatus"] = "APPROVED";
    let reasonCode = "OCR_CONFIDENCE_PASS";

    if (confidenceScore === null || confidenceScore < minimumConfidence) {
      decisionStatus = "REVIEW";
      reasonCode = "OCR_CONFIDENCE_REVIEW";
    }

    if (nameMatchScore !== null && nameMatchScore < minimumNameMatch) {
      decisionStatus = "REVIEW";
      reasonCode = "OCR_NAME_MISMATCH_REVIEW";
    }

    if (!extractedName && !documentNumber.text && !extractedExpiryDate) {
      decisionStatus = "REVIEW";
      reasonCode = "OCR_INSUFFICIENT_DATA";
    }

    return {
      provider: this.key,
      decisionStatus,
      confidenceScore,
      nameMatchScore,
      extractedName,
      extractedDocumentNumber: documentNumber.text,
      extractedExpiryDate,
      reasonCode,
      metadata: {
        providerRegion: this.region,
        extractedDocumentType,
        awsRequestId: response.$metadata.requestId ?? null,
      },
    };
  }
}
