import { createHash } from "crypto";
import { scopedDb } from "@/lib/db/scoped-db";
import type {
  IdentityVerificationMethod,
  IdentityVerificationRecord,
  IdentityVerificationResult,
  VisitorApprovalPolicy,
  VisitorApprovalRequest,
  VisitorApprovalStatus,
  VisitorType,
  VisitorWatchlistEntry,
} from "@prisma/client";
import {
  handlePrismaError,
  RepositoryError,
  requireCompanyId,
} from "./base";

export interface UpsertVisitorApprovalPolicyInput {
  site_id: string;
  template_id?: string;
  name: string;
  rules?: Record<string, unknown>;
  random_check_percentage?: number;
  require_watchlist_screening?: boolean;
  is_active?: boolean;
}

export interface CreateVisitorWatchlistEntryInput {
  full_name: string;
  phone?: string;
  email?: string;
  employer_name?: string;
  reason?: string;
  expires_at?: Date;
}

export interface MatchVisitorAgainstWatchlistInput {
  full_name: string;
  phone?: string;
  email?: string;
}

export interface CreateVisitorApprovalRequestInput {
  site_id: string;
  visitor_name: string;
  visitor_phone?: string;
  visitor_email?: string;
  employer_name?: string;
  visitor_type: VisitorType;
  reason: string;
  policy_id?: string;
  random_check_triggered?: boolean;
  watchlist_match?: boolean;
  watchlist_entry_id?: string;
  pending_sign_in_escalation_id?: string;
  token_seed?: string;
}

export interface TransitionVisitorApprovalRequestInput {
  approval_request_id: string;
  status: VisitorApprovalStatus;
  reviewed_by: string;
  decision_notes?: string;
  sign_in_record_id?: string;
}

export interface CreateIdentityVerificationRecordInput {
  site_id: string;
  visitor_approval_request_id?: string;
  sign_in_record_id?: string;
  method: IdentityVerificationMethod;
  reviewer_user_id?: string;
  evidence_pointer?: string;
  result: IdentityVerificationResult;
  notes?: string;
}

export interface WatchlistMatchResult {
  matched: boolean;
  matched_entry?: VisitorWatchlistEntry;
  reasons: string[];
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePhone(value?: string): string | null {
  if (!value) return null;
  const digits = value.replace(/[^\d+]/g, "");
  return digits.length > 0 ? digits : null;
}

function normalizeEmail(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function clampPercent(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.trunc(value)));
}

export function shouldTriggerRandomCheck(
  seed: string,
  percentage: number,
): boolean {
  const effectivePercentage = clampPercent(percentage);
  if (effectivePercentage <= 0) return false;
  if (effectivePercentage >= 100) return true;

  const digest = createHash("sha256").update(seed).digest("hex");
  const bucket = Number.parseInt(digest.slice(0, 8), 16) % 100;
  return bucket < effectivePercentage;
}

export async function listVisitorApprovalPolicies(
  companyId: string,
  siteId?: string,
): Promise<VisitorApprovalPolicy[]> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.visitorApprovalPolicy.findMany({
      where: {
        ...(siteId ? { site_id: siteId } : {}),
      },
      orderBy: [{ is_active: "desc" }, { updated_at: "desc" }],
    });
  } catch (error) {
    handlePrismaError(error, "VisitorApprovalPolicy");
  }
}

export async function findActiveVisitorApprovalPolicy(
  companyId: string,
  siteId: string,
): Promise<VisitorApprovalPolicy | null> {
  requireCompanyId(companyId);
  try {
    const db = scopedDb(companyId);
    return await db.visitorApprovalPolicy.findFirst({
      where: {
        site_id: siteId,
        is_active: true,
      },
      orderBy: { updated_at: "desc" },
    });
  } catch (error) {
    handlePrismaError(error, "VisitorApprovalPolicy");
  }
}

export async function upsertVisitorApprovalPolicy(
  companyId: string,
  input: UpsertVisitorApprovalPolicyInput,
): Promise<VisitorApprovalPolicy> {
  requireCompanyId(companyId);
  if (!input.site_id.trim()) {
    throw new RepositoryError("site_id is required", "VALIDATION");
  }
  if (!input.name.trim()) {
    throw new RepositoryError("Policy name is required", "VALIDATION");
  }

  const randomCheckPercentage = clampPercent(input.random_check_percentage);

  try {
    const db = scopedDb(companyId);
    const existing = await db.visitorApprovalPolicy.findFirst({
      where: {
        site_id: input.site_id,
      },
      orderBy: { updated_at: "desc" },
    });

    if (!existing) {
      return await db.visitorApprovalPolicy.create({
        data: {
          site_id: input.site_id,
          template_id: input.template_id ?? null,
          name: input.name.trim(),
          rules: input.rules ?? null,
          random_check_percentage: randomCheckPercentage,
          require_watchlist_screening:
            input.require_watchlist_screening !== false,
          is_active: input.is_active !== false,
        },
      });
    }

    await db.visitorApprovalPolicy.updateMany({
      where: { id: existing.id },
      data: {
        template_id: input.template_id ?? null,
        name: input.name.trim(),
        rules: input.rules ?? null,
        random_check_percentage: randomCheckPercentage,
        require_watchlist_screening:
          input.require_watchlist_screening !== false,
        is_active: input.is_active !== false,
      },
    });

    const updated = await db.visitorApprovalPolicy.findFirst({
      where: { id: existing.id },
    });
    if (!updated) {
      throw new RepositoryError("Visitor approval policy not found", "NOT_FOUND");
    }
    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "VisitorApprovalPolicy");
  }
}

export async function createVisitorWatchlistEntry(
  companyId: string,
  input: CreateVisitorWatchlistEntryInput,
): Promise<VisitorWatchlistEntry> {
  requireCompanyId(companyId);
  const name = input.full_name.trim();
  if (!name) {
    throw new RepositoryError("full_name is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.visitorWatchlistEntry.create({
      data: {
        full_name: name,
        phone: normalizePhone(input.phone),
        email: normalizeEmail(input.email),
        employer_name: input.employer_name?.trim() || null,
        normalized_name: normalizeName(name),
        normalized_phone: normalizePhone(input.phone),
        normalized_email: normalizeEmail(input.email),
        reason: input.reason?.trim() || null,
        expires_at: input.expires_at ?? null,
      },
    });
  } catch (error) {
    handlePrismaError(error, "VisitorWatchlistEntry");
  }
}

export async function listVisitorWatchlistEntries(
  companyId: string,
): Promise<VisitorWatchlistEntry[]> {
  requireCompanyId(companyId);
  try {
    const db = scopedDb(companyId);
    return await db.visitorWatchlistEntry.findMany({
      where: { is_active: true },
      orderBy: [{ updated_at: "desc" }],
    });
  } catch (error) {
    handlePrismaError(error, "VisitorWatchlistEntry");
  }
}

export async function deactivateVisitorWatchlistEntry(
  companyId: string,
  entryId: string,
): Promise<void> {
  requireCompanyId(companyId);
  try {
    const db = scopedDb(companyId);
    await db.visitorWatchlistEntry.updateMany({
      where: { id: entryId },
      data: { is_active: false },
    });
  } catch (error) {
    handlePrismaError(error, "VisitorWatchlistEntry");
  }
}

export async function matchVisitorAgainstWatchlist(
  companyId: string,
  input: MatchVisitorAgainstWatchlistInput,
): Promise<WatchlistMatchResult> {
  requireCompanyId(companyId);
  const normalizedName = normalizeName(input.full_name);
  const normalizedPhone = normalizePhone(input.phone);
  const normalizedEmail = normalizeEmail(input.email);

  if (!normalizedName && !normalizedPhone && !normalizedEmail) {
    return { matched: false, reasons: [] };
  }

  try {
    const db = scopedDb(companyId);
    const now = new Date();
    const candidates = await db.visitorWatchlistEntry.findMany({
      where: {
        is_active: true,
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      },
      orderBy: { updated_at: "desc" },
      take: 500,
    });

    for (const entry of candidates) {
      const reasons: string[] = [];
      if (entry.normalized_name === normalizedName) {
        reasons.push("name");
      }
      if (
        normalizedPhone &&
        entry.normalized_phone &&
        entry.normalized_phone === normalizedPhone
      ) {
        reasons.push("phone");
      }
      if (
        normalizedEmail &&
        entry.normalized_email &&
        entry.normalized_email === normalizedEmail
      ) {
        reasons.push("email");
      }

      if (reasons.length > 0) {
        return {
          matched: true,
          matched_entry: entry,
          reasons,
        };
      }
    }

    return { matched: false, reasons: [] };
  } catch (error) {
    handlePrismaError(error, "VisitorWatchlistEntry");
  }
}

export async function createVisitorApprovalRequest(
  companyId: string,
  input: CreateVisitorApprovalRequestInput,
): Promise<VisitorApprovalRequest> {
  requireCompanyId(companyId);
  if (!input.site_id.trim()) {
    throw new RepositoryError("site_id is required", "VALIDATION");
  }
  if (!input.visitor_name.trim()) {
    throw new RepositoryError("visitor_name is required", "VALIDATION");
  }
  if (!input.reason.trim()) {
    throw new RepositoryError("reason is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    const tokenHash = input.token_seed
      ? hashToken(`${companyId}:${input.site_id}:${input.token_seed}`)
      : null;

    return await db.visitorApprovalRequest.create({
      data: {
        site_id: input.site_id,
        visitor_name: input.visitor_name.trim(),
        visitor_phone: normalizePhone(input.visitor_phone),
        visitor_email: normalizeEmail(input.visitor_email),
        employer_name: input.employer_name?.trim() || null,
        visitor_type: input.visitor_type,
        reason: input.reason.trim(),
        policy_id: input.policy_id ?? null,
        random_check_triggered: input.random_check_triggered === true,
        watchlist_match: input.watchlist_match === true,
        watchlist_entry_id: input.watchlist_entry_id ?? null,
        pending_sign_in_escalation_id:
          input.pending_sign_in_escalation_id ?? null,
        channel_action_token_hash: tokenHash,
      },
    });
  } catch (error) {
    handlePrismaError(error, "VisitorApprovalRequest");
  }
}

export async function listVisitorApprovalRequests(
  companyId: string,
  options?: { site_id?: string; status?: VisitorApprovalStatus },
): Promise<VisitorApprovalRequest[]> {
  requireCompanyId(companyId);
  try {
    const db = scopedDb(companyId);
    return await db.visitorApprovalRequest.findMany({
      where: {
        ...(options?.site_id ? { site_id: options.site_id } : {}),
        ...(options?.status ? { status: options.status } : {}),
      },
      orderBy: [{ requested_at: "desc" }],
    });
  } catch (error) {
    handlePrismaError(error, "VisitorApprovalRequest");
  }
}

export async function findVisitorApprovalRequestByTokenHash(
  companyId: string,
  tokenHash: string,
): Promise<VisitorApprovalRequest | null> {
  requireCompanyId(companyId);
  if (!tokenHash.trim()) return null;

  try {
    const db = scopedDb(companyId);
    return await db.visitorApprovalRequest.findFirst({
      where: { channel_action_token_hash: tokenHash },
    });
  } catch (error) {
    handlePrismaError(error, "VisitorApprovalRequest");
  }
}

export async function findLatestVisitorApprovalDecision(
  companyId: string,
  input: {
    site_id: string;
    visitor_phone?: string;
    visitor_email?: string;
  },
): Promise<VisitorApprovalRequest | null> {
  requireCompanyId(companyId);
  const visitorPhone = normalizePhone(input.visitor_phone);
  const visitorEmail = normalizeEmail(input.visitor_email);
  if (!visitorPhone && !visitorEmail) return null;

  try {
    const db = scopedDb(companyId);
    return await db.visitorApprovalRequest.findFirst({
      where: {
        site_id: input.site_id,
        status: { in: ["APPROVED", "DENIED"] },
        OR: [
          ...(visitorPhone ? [{ visitor_phone: visitorPhone }] : []),
          ...(visitorEmail ? [{ visitor_email: visitorEmail }] : []),
        ],
      },
      orderBy: [{ reviewed_at: "desc" }, { updated_at: "desc" }],
    });
  } catch (error) {
    handlePrismaError(error, "VisitorApprovalRequest");
  }
}

export async function transitionVisitorApprovalRequest(
  companyId: string,
  input: TransitionVisitorApprovalRequestInput,
): Promise<VisitorApprovalRequest> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const updated = await db.visitorApprovalRequest.updateMany({
      where: { id: input.approval_request_id },
      data: {
        status: input.status,
        reviewed_by: input.reviewed_by,
        reviewed_at: new Date(),
        decision_notes: input.decision_notes?.trim() || null,
        sign_in_record_id: input.sign_in_record_id ?? null,
      },
    });

    if (updated.count === 0) {
      throw new RepositoryError("Visitor approval request not found", "NOT_FOUND");
    }

    const request = await db.visitorApprovalRequest.findFirst({
      where: { id: input.approval_request_id },
    });
    if (!request) {
      throw new RepositoryError("Visitor approval request not found", "NOT_FOUND");
    }
    return request;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "VisitorApprovalRequest");
  }
}

export async function createIdentityVerificationRecord(
  companyId: string,
  input: CreateIdentityVerificationRecordInput,
): Promise<IdentityVerificationRecord> {
  requireCompanyId(companyId);
  if (!input.site_id.trim()) {
    throw new RepositoryError("site_id is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.identityVerificationRecord.create({
      data: {
        site_id: input.site_id,
        visitor_approval_request_id: input.visitor_approval_request_id ?? null,
        sign_in_record_id: input.sign_in_record_id ?? null,
        method: input.method,
        reviewer_user_id: input.reviewer_user_id ?? null,
        evidence_pointer: input.evidence_pointer?.trim() || null,
        result: input.result,
        notes: input.notes?.trim() || null,
      },
    });
  } catch (error) {
    handlePrismaError(error, "IdentityVerificationRecord");
  }
}

export async function listIdentityVerificationRecords(
  companyId: string,
  siteId?: string,
): Promise<IdentityVerificationRecord[]> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.identityVerificationRecord.findMany({
      where: {
        ...(siteId ? { site_id: siteId } : {}),
      },
      orderBy: [{ created_at: "desc" }],
      take: 200,
    });
  } catch (error) {
    handlePrismaError(error, "IdentityVerificationRecord");
  }
}
