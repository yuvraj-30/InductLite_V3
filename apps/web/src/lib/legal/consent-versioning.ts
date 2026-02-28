/**
 * Legal Consent Versioning Helpers
 *
 * Stores and resolves active legal document versions for sign-in consent.
 */

import { scopedDb } from "@/lib/db/scoped-db";
import type { LegalDocumentType, LegalDocumentVersion } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { requireCompanyId, RepositoryError } from "@/lib/repository/base";

export interface CreateLegalDocumentVersionInput {
  document_type: LegalDocumentType;
  content: string;
  title?: string;
  created_by?: string;
  effective_at?: Date;
}

export interface ActiveLegalVersions {
  terms: LegalDocumentVersion | null;
  privacy: LegalDocumentVersion | null;
}

const DEFAULT_TERMS_TITLE = "InductLite Standard Terms";
const DEFAULT_PRIVACY_TITLE = "InductLite Standard Privacy Notice";

const DEFAULT_TERMS_CONTENT = [
  "Users must provide accurate induction details and follow site safety rules.",
  "Site operators are responsible for maintaining current site requirements.",
  "Tokens and account access are personal and must not be shared.",
].join("\n");

const DEFAULT_PRIVACY_CONTENT = [
  "InductLite stores induction and access records for lawful workplace safety operations.",
  "Personal information is limited to operational and compliance needs.",
  "Retention follows customer policy settings and applicable legal obligations.",
].join("\n");

function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export async function getActiveLegalVersions(
  companyId: string,
  now: Date = new Date(),
): Promise<ActiveLegalVersions> {
  requireCompanyId(companyId);

  const db = scopedDb(companyId);
  const [terms, privacy] = await Promise.all([
    db.legalDocumentVersion.findFirst({
      where: {
        company_id: companyId,
        document_type: "TERMS",
        effective_at: { lte: now },
      },
      orderBy: [{ effective_at: "desc" }, { version: "desc" }],
    }),
    db.legalDocumentVersion.findFirst({
      where: {
        company_id: companyId,
        document_type: "PRIVACY",
        effective_at: { lte: now },
      },
      orderBy: [{ effective_at: "desc" }, { version: "desc" }],
    }),
  ]);

  return { terms, privacy };
}

export async function createLegalDocumentVersion(
  companyId: string,
  input: CreateLegalDocumentVersionInput,
): Promise<LegalDocumentVersion> {
  requireCompanyId(companyId);

  if (!input.content?.trim()) {
    throw new RepositoryError("Legal document content is required", "VALIDATION");
  }

  const db = scopedDb(companyId);
  const latest = await db.legalDocumentVersion.findFirst({
    where: { company_id: companyId, document_type: input.document_type },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const nextVersion = (latest?.version ?? 0) + 1;
  const contentHash = hashContent(input.content.trim());

  return db.legalDocumentVersion.create({
    data: {
      document_type: input.document_type,
      version: nextVersion,
      title: input.title?.trim() || null,
      content_hash: contentHash,
      effective_at: input.effective_at ?? new Date(),
      created_by: input.created_by ?? null,
    },
  });
}

async function createDefaultVersionIfMissing(
  companyId: string,
  documentType: LegalDocumentType,
  title: string,
  content: string,
  effectiveAt: Date,
): Promise<void> {
  const db = scopedDb(companyId);
  const existing = await db.legalDocumentVersion.findFirst({
    where: { company_id: companyId, document_type: documentType },
    orderBy: { version: "desc" },
  });

  if (existing) return;

  try {
    await createLegalDocumentVersion(companyId, {
      document_type: documentType,
      title,
      content,
      effective_at: effectiveAt,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }
    throw error;
  }
}

export async function getOrCreateActiveLegalVersions(
  companyId: string,
  now: Date = new Date(),
): Promise<{
  terms: LegalDocumentVersion;
  privacy: LegalDocumentVersion;
}> {
  requireCompanyId(companyId);

  let active = await getActiveLegalVersions(companyId, now);
  if (active.terms && active.privacy) {
    return { terms: active.terms, privacy: active.privacy };
  }

  if (!active.terms) {
    await createDefaultVersionIfMissing(
      companyId,
      "TERMS",
      DEFAULT_TERMS_TITLE,
      DEFAULT_TERMS_CONTENT,
      now,
    );
  }

  if (!active.privacy) {
    await createDefaultVersionIfMissing(
      companyId,
      "PRIVACY",
      DEFAULT_PRIVACY_TITLE,
      DEFAULT_PRIVACY_CONTENT,
      now,
    );
  }

  // Re-resolve using a fresh timestamp to avoid races between concurrent calls
  // (for example generateMetadata + page render) that can create versions with
  // slightly newer effective_at values than the original `now`.
  active = await getActiveLegalVersions(companyId, new Date());
  if (active.terms && active.privacy) {
    return { terms: active.terms, privacy: active.privacy };
  }

  // Final safety net: if records exist but clock granularity/order causes the
  // active query window to miss them briefly, return latest versions.
  const db = scopedDb(companyId);
  const [latestTerms, latestPrivacy] = await Promise.all([
    db.legalDocumentVersion.findFirst({
      where: {
        company_id: companyId,
        document_type: "TERMS",
      },
      orderBy: [{ effective_at: "desc" }, { version: "desc" }],
    }),
    db.legalDocumentVersion.findFirst({
      where: {
        company_id: companyId,
        document_type: "PRIVACY",
      },
      orderBy: [{ effective_at: "desc" }, { version: "desc" }],
    }),
  ]);

  if (!latestTerms || !latestPrivacy) {
    throw new RepositoryError(
      "Unable to resolve active legal document versions",
      "DATABASE_ERROR",
    );
  }

  return { terms: latestTerms, privacy: latestPrivacy };
}

export function buildConsentStatement(options?: {
  siteName?: string;
  includeEmergencyReminder?: boolean;
}): string {
  const siteSegment = options?.siteName ? ` for ${options.siteName}` : "";
  const reminder = options?.includeEmergencyReminder
    ? " I agree to follow emergency procedures and report hazards immediately."
    : "";
  return `I acknowledge the site safety terms and privacy notice${siteSegment}.${reminder}`.trim();
}
