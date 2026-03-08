import type { IdentityOcrStatus } from "@prisma/client";

export type IdentityOcrDecisionMode = "assist" | "strict";

export interface IdentityOcrProviderInput {
  companyId: string;
  siteId: string;
  visitorName: string;
  documentImageDataUrl: string;
  documentType?: string | null;
  allowedDocumentTypes?: string[];
  decisionMode: IdentityOcrDecisionMode;
}

export interface IdentityOcrProviderResult {
  provider: string;
  decisionStatus: IdentityOcrStatus;
  confidenceScore: number | null;
  nameMatchScore: number | null;
  extractedName: string | null;
  extractedDocumentNumber: string | null;
  extractedExpiryDate: Date | null;
  reasonCode: string | null;
  metadata: Record<string, unknown> | null;
}

export interface IdentityOcrProvider {
  key: string;
  verify(input: IdentityOcrProviderInput): Promise<IdentityOcrProviderResult>;
}
