import { randomBytes } from "crypto";
import type { UserRole } from "@prisma/client";
import { findUnscopedUserByEmail } from "@/lib/db/scoped";
import { scopedDb } from "@/lib/db/scoped-db";
import { hashPassword } from "@/lib/auth/password";

export interface UpsertIdentityUserInput {
  companyId: string;
  provider: string;
  subject: string;
  email: string;
  name: string;
  role: UserRole;
  autoProvisionUsers: boolean;
  markDirectorySync?: boolean;
}

export interface UpsertIdentityUserResult {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created: boolean;
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function normalizeName(name: string, email: string): string {
  const trimmed = name.trim();
  if (trimmed.length >= 2) return trimmed.slice(0, 100);
  const fallback = email.split("@")[0] ?? "User";
  return fallback.slice(0, 100);
}

async function findGlobalUserByEmail(email: string) {
  return findUnscopedUserByEmail(email, {
    select: {
      id: true,
      company_id: true,
    },
  });
}

async function createProvisionedPasswordHash(): Promise<string> {
  const generated = randomBytes(32).toString("base64url");
  return hashPassword(generated);
}

export async function upsertIdentityUser(
  input: UpsertIdentityUserInput,
): Promise<UpsertIdentityUserResult> {
  const companyId = input.companyId.trim();
  const provider = input.provider.trim();
  const subject = input.subject.trim();
  const email = normalizeEmail(input.email);
  const name = normalizeName(input.name, email);

  if (!companyId || !provider || !subject || !email) {
    throw new Error("Identity user payload is incomplete");
  }

  const db = scopedDb(companyId);
  const now = new Date();

  const [existingByIdentity, existingByEmail] = await Promise.all([
    db.user.findFirst({
      where: {
        company_id: companyId,
        identity_provider: provider,
        identity_subject: subject,
      },
    }),
    db.user.findFirst({
      where: {
        company_id: companyId,
        email,
      },
    }),
  ]);

  const existing = existingByIdentity ?? existingByEmail;

  if (existing) {
    await db.user.updateMany({
      where: { id: existing.id, company_id: companyId },
      data: {
        email,
        name,
        role: input.role,
        is_active: true,
        failed_logins: 0,
        locked_until: null,
        identity_provider: provider,
        identity_subject: subject,
        last_login_at: now,
        directory_synced_at: input.markDirectorySync ? now : undefined,
      },
    });

    const updated = await db.user.findFirst({
      where: { id: existing.id, company_id: companyId },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!updated) {
      throw new Error("Failed to load synchronized identity user");
    }

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      created: false,
    };
  }

  if (!input.autoProvisionUsers) {
    throw new Error("SSO account is not provisioned for this workspace");
  }

  const existingGlobal = await findGlobalUserByEmail(email);
  if (existingGlobal && existingGlobal.company_id !== companyId) {
    throw new Error(
      "An account with this email already belongs to a different company workspace",
    );
  }

  const created = await db.user.create({
    data: {
      company_id: companyId,
      email,
      name,
      role: input.role,
      is_active: true,
      password_hash: await createProvisionedPasswordHash(),
      identity_provider: provider,
      identity_subject: subject,
      failed_logins: 0,
      locked_until: null,
      last_login_at: now,
      directory_synced_at: input.markDirectorySync ? now : null,
    },
    select: { id: true, email: true, name: true, role: true },
  });

  return {
    id: created.id,
    email: created.email,
    name: created.name,
    role: created.role,
    created: true,
  };
}

function normalizeRole(value: unknown, fallback: UserRole): UserRole {
  if (value === "ADMIN" || value === "SITE_MANAGER" || value === "VIEWER") {
    return value;
  }
  return fallback;
}

export interface DirectorySyncUserInput {
  externalId: string;
  email: string;
  name: string;
  role?: UserRole | null;
  isActive?: boolean | null;
}

export interface DirectorySyncBatchResult {
  created: number;
  updated: number;
  deactivated: number;
  skipped: number;
}

export async function applyDirectorySyncBatch(input: {
  companyId: string;
  provider: string;
  users: DirectorySyncUserInput[];
  defaultRole: UserRole;
  autoProvisionUsers: boolean;
}): Promise<DirectorySyncBatchResult> {
  const db = scopedDb(input.companyId);
  const result: DirectorySyncBatchResult = {
    created: 0,
    updated: 0,
    deactivated: 0,
    skipped: 0,
  };

  for (const candidate of input.users) {
    const externalId = candidate.externalId?.trim();
    const email = normalizeEmail(candidate.email || "");
    if (!externalId || !email) {
      result.skipped += 1;
      continue;
    }

    const active = candidate.isActive !== false;
    const role = normalizeRole(candidate.role, input.defaultRole);
    const name = normalizeName(candidate.name || "", email);

    if (!active) {
      const existing = await db.user.findFirst({
        where: {
          company_id: input.companyId,
          OR: [
            {
              identity_provider: input.provider,
              identity_subject: externalId,
            },
            { email },
          ],
        },
        select: { id: true },
      });

      if (!existing) {
        result.skipped += 1;
        continue;
      }

      await db.user.updateMany({
        where: { id: existing.id, company_id: input.companyId },
        data: {
          is_active: false,
          directory_synced_at: new Date(),
        },
      });
      result.deactivated += 1;
      continue;
    }

    const synced = await upsertIdentityUser({
      companyId: input.companyId,
      provider: input.provider,
      subject: externalId,
      email,
      name,
      role,
      autoProvisionUsers: input.autoProvisionUsers,
      markDirectorySync: true,
    });

    if (synced.created) {
      result.created += 1;
    } else {
      result.updated += 1;
    }
  }

  return result;
}
