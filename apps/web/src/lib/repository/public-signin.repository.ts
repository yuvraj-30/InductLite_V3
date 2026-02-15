/**
 * Public Sign-In Repository
 *
 * Handles public sign-in operations including:
 * - Atomic sign-in with induction response creation
 * - Token-based self sign-out
 *
 * These operations don't use the standard requireCompanyId guard
 * since they are for public (unauthenticated) access.
 */

import { publicDb } from "@/lib/db/public-db";
import { scopedDb } from "@/lib/db/scoped-db";
import { Prisma } from "@prisma/client";
import { handlePrismaError, RepositoryError } from "./base";
import {
  generateSignOutToken,
  verifySignOutToken,
  hashSignOutToken,
  compareTokenHashes,
} from "@/lib/auth/sign-out-token";
import { formatToE164 } from "@inductlite/shared";
import {
  decryptString,
  encryptJsonValue,
  encryptNullableString,
  encryptString,
} from "@/lib/security/data-protection";

// Types from Prisma schema
type VisitorType = "CONTRACTOR" | "VISITOR" | "EMPLOYEE" | "DELIVERY";

/**
 * Input for public sign-in with induction
 */
export interface PublicSignInInput {
  companyId: string;
  siteId: string;
  idempotencyKey: string;
  visitorName: string;
  visitorPhone: string;
  visitorEmail?: string;
  employerName?: string;
  visitorType: VisitorType;
  roleOnSite?: string;
  hasAcceptedTerms: boolean;
  // Induction response
  templateId: string;
  templateVersion: number;
  answers: Array<{
    questionId: string;
    answer: unknown;
  }>;
}

/**
 * Result of successful sign-in
 */
export interface SignInResult {
  signInRecordId: string;
  signOutToken: string;
  signOutTokenExpiresAt: Date;
  visitorName: string;
  siteName: string;
  signInTime: Date;
}

/**
 * Create a sign-in record with induction response atomically
 *
 * This function:
 * 1. Creates the SignInRecord
 * 2. Creates the InductionResponse with answers
 * 3. Generates a sign-out token
 * 4. Updates the record with the token hash
 *
 * All within a transaction to ensure atomicity.
 */
export async function createPublicSignIn(
  input: PublicSignInInput,
): Promise<SignInResult> {
  // Validate required fields
  if (!input.companyId || !input.siteId) {
    throw new RepositoryError("Company and site are required", "VALIDATION");
  }

  if (!input.visitorName?.trim()) {
    throw new RepositoryError("Visitor name is required", "VALIDATION");
  }

  if (!input.visitorPhone?.trim()) {
    throw new RepositoryError("Phone number is required", "VALIDATION");
  }

  if (!input.idempotencyKey?.trim()) {
    throw new RepositoryError("Idempotency key is required", "VALIDATION");
  }

  if (!input.templateId || !input.answers) {
    throw new RepositoryError(
      "Induction template and answers are required",
      "VALIDATION",
    );
  }

  if (!input.hasAcceptedTerms) {
    throw new RepositoryError(
      "Terms must be accepted before sign-in",
      "VALIDATION",
    );
  }

  // Validate templateVersion is a positive integer
  if (
    typeof input.templateVersion !== "number" ||
    !Number.isInteger(input.templateVersion) ||
    input.templateVersion <= 0
  ) {
    throw new RepositoryError("Invalid template version", "VALIDATION");
  }

  // Validate and format phone to E.164 using shared utility
  // This ensures consistent storage and reduces token/verification mismatches
  const formattedPhone = formatToE164(input.visitorPhone, "NZ");
  if (!formattedPhone) {
    throw new RepositoryError("Invalid phone number", "VALIDATION");
  }

  try {
    type SignInWithSite = Prisma.SignInRecordGetPayload<{
      include: { site: { select: { name: true } } };
    }>;

    const findByIdempotencyKey = async (): Promise<SignInWithSite | null> => {
      return publicDb.signInRecord.findFirst({
        where: {
          company_id: input.companyId,
          idempotency_key: input.idempotencyKey,
        },
        include: {
          site: {
            select: { name: true },
          },
        },
      });
    };

    // Use transaction for atomicity - create sign-in record without token first.
    let result = await publicDb.$transaction(async (tx) => {
      const db = scopedDb(input.companyId, tx);

      const existing = await db.signInRecord.findFirst({
        where: {
          company_id: input.companyId,
          idempotency_key: input.idempotencyKey,
        },
        include: {
          site: {
            select: { name: true },
          },
        },
      });

      if (existing) {
        return existing;
      }

      // 1. Create sign-in record (token will be added after we have the ID)
      const signInRecord = await db.signInRecord.create({
        data: {
          site_id: input.siteId,
          idempotency_key: input.idempotencyKey,
          visitor_name: input.visitorName.trim(),
          visitor_phone: encryptString(formattedPhone),
          visitor_email: encryptNullableString(input.visitorEmail?.trim() || null),
          employer_name: input.employerName?.trim() || null,
          visitor_type: input.visitorType,
          hasAcceptedTerms: true,
          termsAcceptedAt: new Date(),
          notes: input.roleOnSite ? `Role: ${input.roleOnSite}` : null,
          // Token fields will be set after transaction
          sign_out_token: null,
          sign_out_token_exp: null,
        },
        include: {
          site: {
            select: { name: true },
          },
        },
      });

      // 2. Verify template ownership and version to enforce tenant scoping
      // First look up the template by ID so we can distinguish a missing template
      // (FOREIGN_KEY) from a template that exists but belongs to another company
      // (FORBIDDEN). We intentionally do a bare id lookup so we can provide a
      // descriptive error to callers — we enforce tenant scoping by checking
      // the returned template's company_id below.
      /* eslint-disable security-guardrails/require-company-id -- intentional id-only lookup followed by explicit company_id check */
      const templateById = await tx.inductionTemplate.findFirst({
        where: { id: input.templateId },
        select: { id: true, company_id: true, version: true },
      });
      /* eslint-enable security-guardrails/require-company-id */

      if (!templateById) {
        throw new RepositoryError("Selected template not found", "FOREIGN_KEY");
      }

      if (templateById.company_id !== input.companyId) {
        throw new RepositoryError(
          "Template belongs to another company",
          "FORBIDDEN",
        );
      }

      if (templateById.version !== input.templateVersion) {
        throw new RepositoryError("Invalid template version", "VALIDATION");
      }

      // 3. Validate answers are JSON-serializable to avoid runtime errors (eg: circular refs)
      try {
        JSON.stringify(input.answers);
      } catch (err) {
        if (err instanceof Error) {
          // Re-throw underlying message for better test visibility (e.g. "Invalid JSON")
          throw new RepositoryError(err.message, "VALIDATION");
        }
        throw new RepositoryError("Unserializable answers", "VALIDATION");
      }

      // 4. Create induction response
      await tx.inductionResponse.create({
        data: {
          sign_in_record_id: signInRecord.id,
          template_id: input.templateId,
          template_version: input.templateVersion,
          answers: encryptJsonValue(input.answers) as Prisma.InputJsonValue,
          passed: true, // All required fields validated before this point
        },
      });

      return signInRecord;
    });

    // Handle concurrent duplicate submissions racing on the unique key.
    if (!result) {
      const existing = await findByIdempotencyKey();
      if (existing) {
        result = existing;
      }
    }

    // 3. Generate the sign-out token once with the real record ID
    const { token: signOutToken, expiresAt } = generateSignOutToken(
      result.id,
      input.visitorPhone,
    );

    // 4. Compute token hash for revocation check and persist
    const tokenHash = hashSignOutToken(signOutToken);

    // 5. Update the record with token hash and expiry for revocation
    await publicDb.signInRecord.updateMany({
      where: { id: result.id, company_id: input.companyId },
      data: {
        sign_out_token: tokenHash, // Store hash for revocation check
        sign_out_token_exp: expiresAt,
      },
    });

    return {
      signInRecordId: result.id,
      signOutToken: signOutToken,
      signOutTokenExpiresAt: expiresAt,
      visitorName: result.visitor_name,
      siteName: result.site.name,
      signInTime: result.sign_in_ts,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        // Unique race on (company_id, idempotency_key): return existing record result.
        const existing = await publicDb.signInRecord.findFirst({
          where: {
            company_id: input.companyId,
            idempotency_key: input.idempotencyKey,
          },
          include: { site: { select: { name: true } } },
        });

        if (existing) {
          const { token: signOutToken, expiresAt } = generateSignOutToken(
            existing.id,
            input.visitorPhone,
          );
          const tokenHash = hashSignOutToken(signOutToken);

          await publicDb.signInRecord.updateMany({
            where: { id: existing.id, company_id: input.companyId },
            data: {
              sign_out_token: tokenHash,
              sign_out_token_exp: expiresAt,
            },
          });

          return {
            signInRecordId: existing.id,
            signOutToken,
            signOutTokenExpiresAt: expiresAt,
            visitorName: existing.visitor_name,
            siteName: existing.site.name,
            signInTime: existing.sign_in_ts,
          };
        }
      }
    }

    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "SignInRecord");
    throw error; // TypeScript satisfaction
  }
}

/**
 * Sign out using a token (self-service)
 *
 * SECURITY: Uses atomic update with compound WHERE to prevent:
 * - TOCTOU attacks where sign-out state changes between check and update
 * - Token replay attacks by atomically clearing the token hash
 *
 * @param token - The sign-out token
 * @param phone - The visitor's phone number for verification
 * @returns The updated sign-in record
 */
export async function signOutWithToken(
  token: string,
  phone: string,
): Promise<{
  success: boolean;
  visitorName?: string;
  signInRecordId?: string;
  companyId?: string;
  siteId?: string;
  siteName?: string;
  error?: string;
}> {
  // 1. Verify the token cryptographically first
  const verification = verifySignOutToken(token, phone);

  if (!verification.valid) {
    const errorMessages = {
      INVALID_FORMAT: "Invalid sign-out link",
      INVALID_SIGNATURE: "Invalid sign-out link",
      EXPIRED: "Sign-out link has expired. Please contact site reception.",
      PHONE_MISMATCH: "Phone number does not match the sign-in record",
    };
    return {
      success: false,
      error: errorMessages[verification.error!] || "Invalid sign-out link",
    };
  }

  try {
    // 2. Compute token hash for atomic comparison
    const providedTokenHash = hashSignOutToken(token);

    // 3. Normalize phone for comparison using E.164-aware formatter.
    // Try to compare canonical E.164 values when possible to avoid mismatches
    // due to local formatting. Fall back to digit-only comparison for legacy data.
    const inputE164 = formatToE164(phone, "NZ");
    const inputDigits = phone.replace(/\D/g, "");

    // 4. Atomic update with all conditions in WHERE clause
    // This prevents TOCTOU: all checks and the update happen atomically
    // eslint-disable-next-line security-guardrails/require-company-id -- signInRecordId is globally unique, token hash provides auth
    const result = await publicDb.signInRecord.updateMany({
      where: {
        id: verification.signInRecordId,
        sign_out_ts: null, // Not already signed out
        sign_out_token: providedTokenHash, // Token hash matches (one-time use)
        OR: [
          { sign_out_token_exp: null }, // No expiry set
          { sign_out_token_exp: { gte: new Date() } }, // Not expired
        ],
      },
      data: {
        sign_out_ts: new Date(),
        signed_out_by: null, // Self sign-out
        sign_out_token: null, // Revoke token - clear hash
        sign_out_token_exp: null, // Clear expiry
      },
    });

    // 5. If no rows updated, determine the specific error
    if (result.count === 0) {
      // eslint-disable-next-line security-guardrails/require-company-id -- signInRecordId is globally unique
      const signInRecord = await publicDb.signInRecord.findFirst({
        where: { id: verification.signInRecordId },
        select: {
          id: true,
          visitor_phone: true,
          sign_out_ts: true,
          sign_out_token: true,
          sign_out_token_exp: true,
        },
      });

      if (!signInRecord) {
        return { success: false, error: "Sign-in record not found" };
      }

      if (signInRecord.sign_out_ts) {
        return { success: false, error: "You have already signed out" };
      }

      // Verify phone matches (prefer E.164 comparison when available)
      const decryptedPhone = decryptString(signInRecord.visitor_phone);
      const recordE164 = formatToE164(decryptedPhone, "NZ");
      const recordDigits = decryptedPhone.replace(/\D/g, "");

      if (inputE164 && recordE164) {
        if (inputE164 !== recordE164) {
          return { success: false, error: "Phone number does not match" };
        }
      } else {
        if (inputDigits !== recordDigits) {
          return { success: false, error: "Phone number does not match" };
        }
      }

      // Token hash doesn't match or was revoked
      if (!signInRecord.sign_out_token) {
        return { success: false, error: "Invalid sign-out link" };
      }

      if (!compareTokenHashes(signInRecord.sign_out_token, providedTokenHash)) {
        return { success: false, error: "Invalid sign-out link" };
      }

      // Token expired
      if (
        signInRecord.sign_out_token_exp &&
        new Date() > signInRecord.sign_out_token_exp
      ) {
        return {
          success: false,
          error: "Sign-out link has expired. Please contact site reception.",
        };
      }

      // Shouldn't reach here
      return { success: false, error: "Invalid sign-out link" };
    }

    // 6. Fetch the record details for response
    // eslint-disable-next-line security-guardrails/require-company-id -- signInRecordId is globally unique
    const signInRecord = await publicDb.signInRecord.findFirst({
      where: { id: verification.signInRecordId },
      select: {
        id: true,
        visitor_name: true,
        company_id: true,
        site_id: true,
        site: {
          select: { name: true },
        },
      },
    });

    if (!signInRecord) {
      // Shouldn't happen since we just updated it, but handle gracefully
      return { success: false, error: "Sign-in record not found" };
    }

    return {
      success: true,
      visitorName: signInRecord.visitor_name,
      signInRecordId: signInRecord.id,
      companyId: signInRecord.company_id,
      siteId: signInRecord.site_id,
      siteName: signInRecord.site.name,
    };
  } catch (error) {
    handlePrismaError(error, "SignInRecord");
    return { success: false, error: "Failed to sign out" };
  }
}

/**
 * Find sign-in record by ID (for public verification)
 */
export async function findPublicSignInById(signInRecordId: string): Promise<{
  id: string;
  visitorName: string;
  siteName: string;
  signInTime: Date;
  signOutTime: Date | null;
  companyName: string;
} | null> {
  try {
    // eslint-disable-next-line security-guardrails/require-company-id -- public lookup by globally unique ID
    const record = await publicDb.signInRecord.findFirst({
      where: { id: signInRecordId },
      select: {
        id: true,
        visitor_name: true,
        sign_in_ts: true,
        sign_out_ts: true,
        site: {
          select: { name: true },
        },
        company: {
          select: { name: true },
        },
      },
    });

    if (!record) return null;

    return {
      id: record.id,
      visitorName: record.visitor_name,
      siteName: record.site.name,
      signInTime: record.sign_in_ts,
      signOutTime: record.sign_out_ts,
      companyName: record.company.name,
    };
  } catch (error) {
    handlePrismaError(error, "SignInRecord");
    return null;
  }
}
