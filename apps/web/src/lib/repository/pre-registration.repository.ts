/**
 * Pre-Registration Invite Repository
 *
 * Handles pre-registration and invite link persistence with tenant scoping.
 */

import { scopedDb } from "@/lib/db/scoped-db";
import type { VisitorType } from "@prisma/client";
import { createHash } from "crypto";
import { nanoid } from "nanoid";
import {
  decryptNullableString,
  decryptString,
  encryptNullableString,
  encryptString,
} from "@/lib/security/data-protection";
import {
  RepositoryError,
  handlePrismaError,
  normalizePagination,
  paginatedResult,
  requireCompanyId,
  type PaginatedResult,
  type PaginationParams,
} from "./base";

const DEFAULT_EXPIRY_DAYS = 7;
const INVITE_TOKEN_LENGTH = 24;

export interface CreatePreRegistrationInviteInput {
  siteId: string;
  visitorName: string;
  visitorPhone: string;
  visitorEmail?: string;
  employerName?: string;
  visitorType: VisitorType;
  roleOnSite?: string;
  notes?: string;
  expiresAt?: Date;
  createdBy?: string;
}

export interface PreRegistrationInviteRecord {
  id: string;
  company_id: string;
  site_id: string;
  created_by: string | null;
  visitor_name: string;
  visitor_phone: string;
  visitor_email: string | null;
  employer_name: string | null;
  visitor_type: VisitorType;
  role_on_site: string | null;
  notes: string | null;
  is_active: boolean;
  expires_at: Date;
  used_at: Date | null;
  used_sign_in_record_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreatedPreRegistrationInvite {
  invite: PreRegistrationInviteRecord;
  inviteToken: string;
}

export interface PreRegistrationInviteFilter {
  siteId?: string;
  includeInactive?: boolean;
}

function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function normalizeInviteRecord(
  invite: Omit<PreRegistrationInviteRecord, "visitor_phone" | "visitor_email"> & {
    visitor_phone: string;
    visitor_email: string | null;
  },
): PreRegistrationInviteRecord {
  return {
    ...invite,
    visitor_phone: decryptString(invite.visitor_phone),
    visitor_email: decryptNullableString(invite.visitor_email),
  };
}

function defaultExpiryDate(): Date {
  return new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

export async function createPreRegistrationInvite(
  companyId: string,
  input: CreatePreRegistrationInviteInput,
): Promise<CreatedPreRegistrationInvite> {
  requireCompanyId(companyId);
  if (!input.siteId.trim()) {
    throw new RepositoryError("siteId is required", "VALIDATION");
  }

  const inviteToken = nanoid(INVITE_TOKEN_LENGTH);
  const tokenHash = hashInviteToken(inviteToken);

  try {
    const db = scopedDb(companyId);
    const site = await db.site.findFirst({
      where: { company_id: companyId, id: input.siteId, is_active: true },
      select: { id: true },
    });
    if (!site) {
      throw new RepositoryError("Site not found", "NOT_FOUND");
    }

    const created = await db.preRegistrationInvite.create({
      data: {
        site_id: input.siteId,
        created_by: input.createdBy ?? null,
        token_hash: tokenHash,
        visitor_name: input.visitorName.trim(),
        visitor_phone: encryptString(input.visitorPhone.trim()),
        visitor_email: encryptNullableString(input.visitorEmail?.trim() || null),
        employer_name: input.employerName?.trim() || null,
        visitor_type: input.visitorType,
        role_on_site: input.roleOnSite?.trim() || null,
        notes: input.notes?.trim() || null,
        expires_at: input.expiresAt ?? defaultExpiryDate(),
      },
    });

    return {
      invite: normalizeInviteRecord(created),
      inviteToken,
    };
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "PreRegistrationInvite");
  }
}

export async function listPreRegistrationInvites(
  companyId: string,
  filter?: PreRegistrationInviteFilter,
  pagination?: PaginationParams,
): Promise<PaginatedResult<PreRegistrationInviteRecord>> {
  requireCompanyId(companyId);
  const { skip, take, page, pageSize } = normalizePagination(pagination ?? {});

  try {
    const db = scopedDb(companyId);
    const now = new Date();
    const where = {
      company_id: companyId,
      ...(filter?.siteId ? { site_id: filter.siteId } : {}),
      ...(filter?.includeInactive
        ? {}
        : { is_active: true, used_at: null, expires_at: { gte: now } }),
    };

    const [items, total] = await Promise.all([
      db.preRegistrationInvite.findMany({
        where,
        skip,
        take,
        orderBy: [{ created_at: "desc" }],
      }),
      db.preRegistrationInvite.count({ where }),
    ]);

    return paginatedResult(
      items.map((invite) => normalizeInviteRecord(invite)),
      total,
      page,
      pageSize,
    );
  } catch (error) {
    handlePrismaError(error, "PreRegistrationInvite");
  }
}

export async function findActivePreRegistrationInviteByToken(
  companyId: string,
  siteId: string,
  inviteToken: string,
): Promise<PreRegistrationInviteRecord | null> {
  requireCompanyId(companyId);
  if (!siteId.trim() || !inviteToken.trim()) {
    return null;
  }

  try {
    const db = scopedDb(companyId);
    const tokenHash = hashInviteToken(inviteToken);

    const invite = await db.preRegistrationInvite.findFirst({
      where: {
        company_id: companyId,
        site_id: siteId,
        token_hash: tokenHash,
        is_active: true,
        used_at: null,
        expires_at: { gte: new Date() },
      },
    });

    if (!invite) {
      return null;
    }

    return normalizeInviteRecord(invite);
  } catch (error) {
    handlePrismaError(error, "PreRegistrationInvite");
  }
}

export async function markPreRegistrationInviteUsed(
  companyId: string,
  inviteId: string,
  signInRecordId: string,
): Promise<boolean> {
  requireCompanyId(companyId);
  if (!inviteId.trim() || !signInRecordId.trim()) {
    throw new RepositoryError(
      "inviteId and signInRecordId are required",
      "VALIDATION",
    );
  }

  try {
    const db = scopedDb(companyId);
    const result = await db.preRegistrationInvite.updateMany({
      where: {
        company_id: companyId,
        id: inviteId,
        is_active: true,
        used_at: null,
      },
      data: {
        used_at: new Date(),
        used_sign_in_record_id: signInRecordId,
      },
    });

    return result.count > 0;
  } catch (error) {
    handlePrismaError(error, "PreRegistrationInvite");
  }
}

export async function deactivatePreRegistrationInvite(
  companyId: string,
  inviteId: string,
): Promise<boolean> {
  requireCompanyId(companyId);
  if (!inviteId.trim()) {
    throw new RepositoryError("inviteId is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    const result = await db.preRegistrationInvite.updateMany({
      where: {
        company_id: companyId,
        id: inviteId,
      },
      data: {
        is_active: false,
      },
    });

    return result.count > 0;
  } catch (error) {
    handlePrismaError(error, "PreRegistrationInvite");
  }
}
