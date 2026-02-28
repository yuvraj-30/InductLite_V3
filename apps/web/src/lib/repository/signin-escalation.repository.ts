/**
 * Sign-In Escalation Repository
 *
 * Manages red-flag sign-in escalations requiring supervisor review.
 */

import { scopedDb } from "@/lib/db/scoped-db";
import { Prisma, type SignInEscalationStatus } from "@prisma/client";
import { formatToE164 } from "@inductlite/shared";
import {
  decryptJsonValue,
  decryptNullableString,
  decryptString,
  encryptJsonValue,
  encryptNullableString,
  encryptString,
} from "@/lib/security/data-protection";
import { handlePrismaError, RepositoryError, requireCompanyId } from "./base";

interface EscalationAnswer {
  questionId: string;
  answer: unknown;
}

export interface CreateSignInEscalationInput {
  companyId: string;
  siteId: string;
  idempotencyKey: string;
  visitorName: string;
  visitorPhone: string;
  visitorEmail?: string;
  employerName?: string;
  visitorType: "CONTRACTOR" | "VISITOR" | "EMPLOYEE" | "DELIVERY";
  roleOnSite?: string;
  hasAcceptedTerms: boolean;
  termsAcceptedAt?: Date;
  termsVersionId?: string;
  privacyVersionId?: string;
  consentStatement?: string;
  templateId: string;
  templateVersion: number;
  answers: EscalationAnswer[];
  signatureData: string;
  redFlagQuestionIds: string[];
  redFlagQuestions: string[];
}

export interface SignInEscalationRecord {
  id: string;
  company_id: string;
  site_id: string;
  idempotency_key: string;
  status: SignInEscalationStatus;
  visitor_name: string;
  visitor_phone: string;
  visitor_email: string | null;
  employer_name: string | null;
  visitor_type: "CONTRACTOR" | "VISITOR" | "EMPLOYEE" | "DELIVERY";
  role_on_site: string | null;
  hasAcceptedTerms: boolean;
  termsAcceptedAt: Date | null;
  terms_version_id: string | null;
  privacy_version_id: string | null;
  consent_statement: string | null;
  template_id: string;
  template_version: number;
  answers: EscalationAnswer[];
  signature_data: string | null;
  red_flag_question_ids: string[];
  red_flag_questions: string[];
  notification_targets: number;
  notifications_queued: number;
  submitted_at: Date;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  review_notes: string | null;
  approved_sign_in_record_id: string | null;
  created_at: Date;
  updated_at: Date;
}

const ESCALATION_SELECT = {
  id: true,
  company_id: true,
  site_id: true,
  idempotency_key: true,
  status: true,
  visitor_name: true,
  visitor_phone: true,
  visitor_email: true,
  employer_name: true,
  visitor_type: true,
  role_on_site: true,
  hasAcceptedTerms: true,
  termsAcceptedAt: true,
  terms_version_id: true,
  privacy_version_id: true,
  consent_statement: true,
  template_id: true,
  template_version: true,
  answers: true,
  signature_data: true,
  red_flag_question_ids: true,
  red_flag_questions: true,
  notification_targets: true,
  notifications_queued: true,
  submitted_at: true,
  reviewed_at: true,
  reviewed_by: true,
  review_notes: true,
  approved_sign_in_record_id: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.PendingSignInEscalationSelect;

type EscalationRow = Prisma.PendingSignInEscalationGetPayload<{
  select: typeof ESCALATION_SELECT;
}>;

function normalizePhoneE164(phone: string): string {
  const formatted = formatToE164(phone, "NZ");
  if (!formatted) {
    throw new RepositoryError("Invalid phone number", "VALIDATION");
  }
  return formatted;
}

function toStringArray(value: unknown): string[] {
  const parsed = decryptJsonValue<unknown>(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((entry): entry is string => typeof entry === "string");
}

function toAnswers(value: unknown): EscalationAnswer[] {
  const parsed = decryptJsonValue<unknown>(value);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter(
      (entry): entry is { questionId: string; answer: unknown } =>
        Boolean(entry) &&
        typeof entry === "object" &&
        typeof (entry as Record<string, unknown>).questionId === "string",
    )
    .map((entry) => ({
      questionId: entry.questionId,
      answer: entry.answer,
    }));
}

function decryptEscalation(row: EscalationRow): SignInEscalationRecord {
  return {
    ...row,
    visitor_phone: decryptString(row.visitor_phone),
    visitor_email: decryptNullableString(row.visitor_email),
    answers: toAnswers(row.answers),
    signature_data: decryptNullableString(row.signature_data),
    red_flag_question_ids: toStringArray(row.red_flag_question_ids),
    red_flag_questions: toStringArray(row.red_flag_questions),
  };
}

function validateEscalationPayload(input: CreateSignInEscalationInput) {
  if (!input.companyId || !input.siteId) {
    throw new RepositoryError("Company and site are required", "VALIDATION");
  }
  if (!input.idempotencyKey?.trim()) {
    throw new RepositoryError("Idempotency key is required", "VALIDATION");
  }
  if (!input.visitorName?.trim()) {
    throw new RepositoryError("Visitor name is required", "VALIDATION");
  }
  if (!input.signatureData?.trim()) {
    throw new RepositoryError("Signature is required", "VALIDATION");
  }
  if (!input.templateId) {
    throw new RepositoryError("Template is required", "VALIDATION");
  }
  if (!input.hasAcceptedTerms) {
    throw new RepositoryError(
      "Terms must be accepted before escalation",
      "VALIDATION",
    );
  }

  try {
    JSON.stringify(input.answers);
    JSON.stringify(input.redFlagQuestionIds);
    JSON.stringify(input.redFlagQuestions);
  } catch (error) {
    throw new RepositoryError(
      error instanceof Error ? error.message : "Unserializable escalation data",
      "VALIDATION",
    );
  }
}

export async function createPendingSignInEscalation(
  input: CreateSignInEscalationInput,
): Promise<{ escalation: SignInEscalationRecord; created: boolean }> {
  validateEscalationPayload(input);

  const normalizedPhone = normalizePhoneE164(input.visitorPhone);

  try {
    const db = scopedDb(input.companyId);
    const existing = await db.pendingSignInEscalation.findFirst({
      where: {
        company_id: input.companyId,
        idempotency_key: input.idempotencyKey,
      },
      select: ESCALATION_SELECT,
    });

    if (existing) {
      return {
        escalation: decryptEscalation(existing),
        created: false,
      };
    }

    const created = await db.pendingSignInEscalation.create({
      data: {
        site_id: input.siteId,
        idempotency_key: input.idempotencyKey,
        visitor_name: input.visitorName.trim(),
        visitor_phone: encryptString(normalizedPhone),
        visitor_email: encryptNullableString(input.visitorEmail?.trim() || null),
        employer_name: input.employerName?.trim() || null,
        visitor_type: input.visitorType,
        role_on_site: input.roleOnSite?.trim() || null,
        hasAcceptedTerms: input.hasAcceptedTerms,
        termsAcceptedAt: input.termsAcceptedAt ?? new Date(),
        terms_version_id: input.termsVersionId ?? null,
        privacy_version_id: input.privacyVersionId ?? null,
        consent_statement: input.consentStatement ?? null,
        template_id: input.templateId,
        template_version: input.templateVersion,
        answers: encryptJsonValue(input.answers) as Prisma.InputJsonValue,
        signature_data: encryptNullableString(input.signatureData.trim()),
        red_flag_question_ids: input.redFlagQuestionIds as Prisma.InputJsonValue,
        red_flag_questions: input.redFlagQuestions as Prisma.InputJsonValue,
      },
      select: ESCALATION_SELECT,
    });

    return {
      escalation: decryptEscalation(created),
      created: true,
    };
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "PendingSignInEscalation");
  }
}

export async function findSignInEscalationById(
  companyId: string,
  escalationId: string,
): Promise<SignInEscalationRecord | null> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const record = await db.pendingSignInEscalation.findFirst({
      where: { id: escalationId, company_id: companyId },
      select: ESCALATION_SELECT,
    });

    return record ? decryptEscalation(record) : null;
  } catch (error) {
    handlePrismaError(error, "PendingSignInEscalation");
  }
}

export async function listSignInEscalations(
  companyId: string,
  options: {
    status?: SignInEscalationStatus | SignInEscalationStatus[];
    siteId?: string;
    limit?: number;
  } = {},
): Promise<SignInEscalationRecord[]> {
  requireCompanyId(companyId);

  const safeLimit = Math.max(1, Math.min(options.limit ?? 100, 200));

  try {
    const db = scopedDb(companyId);
    const records = await db.pendingSignInEscalation.findMany({
      where: {
        company_id: companyId,
        ...(options.siteId ? { site_id: options.siteId } : {}),
        ...(options.status
          ? {
              status: Array.isArray(options.status)
                ? { in: options.status }
                : options.status,
            }
          : {}),
      },
      select: ESCALATION_SELECT,
      orderBy: [{ status: "asc" }, { submitted_at: "desc" }],
      take: safeLimit,
    });

    return records.map((record) => decryptEscalation(record));
  } catch (error) {
    handlePrismaError(error, "PendingSignInEscalation");
  }
}

export async function setSignInEscalationNotificationCounts(
  companyId: string,
  escalationId: string,
  notificationTargets: number,
  notificationsQueued: number,
): Promise<void> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    await db.pendingSignInEscalation.updateMany({
      where: { id: escalationId, company_id: companyId },
      data: {
        notification_targets: Math.max(0, notificationTargets),
        notifications_queued: Math.max(0, notificationsQueued),
      },
    });
  } catch (error) {
    handlePrismaError(error, "PendingSignInEscalation");
  }
}

export async function approveSignInEscalation(
  companyId: string,
  escalationId: string,
  input: {
    reviewedBy: string;
    approvedSignInRecordId: string;
    reviewNotes?: string;
  },
): Promise<SignInEscalationRecord> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const result = await db.pendingSignInEscalation.updateMany({
      where: {
        id: escalationId,
        company_id: companyId,
        status: "PENDING",
      },
      data: {
        status: "APPROVED",
        reviewed_by: input.reviewedBy,
        reviewed_at: new Date(),
        review_notes: input.reviewNotes?.trim() || null,
        approved_sign_in_record_id: input.approvedSignInRecordId,
      },
    });

    if (result.count === 0) {
      const existing = await db.pendingSignInEscalation.findFirst({
        where: { id: escalationId, company_id: companyId },
        select: { status: true },
      });
      if (!existing) {
        throw new RepositoryError("Escalation not found", "NOT_FOUND");
      }
      throw new RepositoryError("Escalation already resolved", "VALIDATION");
    }

    const updated = await db.pendingSignInEscalation.findFirst({
      where: { id: escalationId, company_id: companyId },
      select: ESCALATION_SELECT,
    });
    if (!updated) {
      throw new RepositoryError("Escalation not found", "NOT_FOUND");
    }

    return decryptEscalation(updated);
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "PendingSignInEscalation");
  }
}

export async function denySignInEscalation(
  companyId: string,
  escalationId: string,
  input: {
    reviewedBy: string;
    reviewNotes?: string;
  },
): Promise<SignInEscalationRecord> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const result = await db.pendingSignInEscalation.updateMany({
      where: {
        id: escalationId,
        company_id: companyId,
        status: "PENDING",
      },
      data: {
        status: "DENIED",
        reviewed_by: input.reviewedBy,
        reviewed_at: new Date(),
        review_notes: input.reviewNotes?.trim() || null,
      },
    });

    if (result.count === 0) {
      const existing = await db.pendingSignInEscalation.findFirst({
        where: { id: escalationId, company_id: companyId },
        select: { status: true },
      });
      if (!existing) {
        throw new RepositoryError("Escalation not found", "NOT_FOUND");
      }
      throw new RepositoryError("Escalation already resolved", "VALIDATION");
    }

    const updated = await db.pendingSignInEscalation.findFirst({
      where: { id: escalationId, company_id: companyId },
      select: ESCALATION_SELECT,
    });
    if (!updated) {
      throw new RepositoryError("Escalation not found", "NOT_FOUND");
    }

    return decryptEscalation(updated);
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "PendingSignInEscalation");
  }
}
