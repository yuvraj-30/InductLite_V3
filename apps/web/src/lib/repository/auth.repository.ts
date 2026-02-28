/**
 * Auth Repository
 *
 * Handles self-serve signup persistence behind a repository boundary.
 */

import { randomBytes } from "crypto";
import { publicDb } from "@/lib/db/public-db";
import { handlePrismaError, RepositoryError } from "./base";

export interface RegisterCompanyWithAdminInput {
  companyName: string;
  adminName: string;
  adminEmail: string;
  adminPasswordHash: string;
  firstSiteName: string;
  requestId?: string;
}

export interface RegisterCompanyWithAdminResult {
  companyId: string;
}

function slugifyCompanyName(companyName: string): string {
  const base = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);

  return base || "company";
}

async function generateUniqueCompanySlug(companyName: string): Promise<string> {
  const base = slugifyCompanyName(companyName);
  let candidate = base;
  let counter = 2;

  while (true) {
    const exists = await publicDb.company.findFirst({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!exists) return candidate;

    const suffix = `-${counter}`;
    candidate = `${base.slice(0, Math.max(1, 48 - suffix.length))}${suffix}`;
    counter += 1;
  }
}

function generateSecurePublicSlug(): string {
  return randomBytes(16).toString("base64url");
}

export async function registerCompanyWithAdmin(
  input: RegisterCompanyWithAdminInput,
): Promise<RegisterCompanyWithAdminResult> {
  const normalizedEmail = input.adminEmail.toLowerCase().trim();

  if (!normalizedEmail) {
    throw new RepositoryError("Admin email is required", "VALIDATION");
  }

  try {
    // eslint-disable-next-line security-guardrails/require-company-id -- signup/login bootstrap lookup by unique email is allowlisted
    const existingUser = await publicDb.user.findFirst({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      throw new RepositoryError(
        "An account with this email already exists",
        "ALREADY_EXISTS",
      );
    }

    const slug = await generateUniqueCompanySlug(input.companyName);

    const created = await publicDb.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: input.companyName.trim(),
          slug,
          retention_days: 365,
        },
      });

      const user = await tx.user.create({
        data: {
          company_id: company.id,
          email: normalizedEmail,
          password_hash: input.adminPasswordHash,
          name: input.adminName.trim(),
          role: "ADMIN",
          is_active: true,
        },
      });

      const site = await tx.site.create({
        data: {
          company_id: company.id,
          name: input.firstSiteName.trim(),
          is_active: true,
        },
      });

      // Ensure the founding admin receives site-level escalation notifications.
      await tx.siteManagerAssignment.create({
        data: {
          company_id: company.id,
          site_id: site.id,
          user_id: user.id,
        },
      });

      await tx.sitePublicLink.create({
        data: {
          site_id: site.id,
          slug: generateSecurePublicSlug(),
          is_active: true,
        },
      });

      await tx.auditLog.create({
        data: {
          company_id: company.id,
          user_id: user.id,
          action: "company.signup",
          entity_type: "Company",
          entity_id: company.id,
          details: {
            company_name: company.name,
            first_site_name: site.name,
          },
          request_id: input.requestId,
        },
      });

      return { companyId: company.id };
    });

    return created;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "CompanySignup");
  }
}
