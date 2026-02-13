/**
 * Magic Link Repository
 *
 * Handles magic link token persistence and consumption.
 */

import { publicDb } from "@/lib/db/public-db";
import { scopedDb } from "@/lib/db/scoped-db";
import { handlePrismaError, requireCompanyId } from "./base";

export interface MagicLinkTokenRecord {
  id: string;
  company_id: string;
  contractor_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
}

export async function createMagicLinkToken(
  companyId: string,
  contractorId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<MagicLinkTokenRecord> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.magicLinkToken.create({
      data: {
        company_id: companyId,
        contractor_id: contractorId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });
  } catch (error) {
    handlePrismaError(error, "MagicLinkToken");
  }
}

export async function findMagicLinkTokenById(
  companyId: string,
  tokenId: string,
): Promise<MagicLinkTokenRecord | null> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.magicLinkToken.findFirst({
      where: { company_id: companyId, id: tokenId },
    });
  } catch (error) {
    handlePrismaError(error, "MagicLinkToken");
  }
}

export async function consumeMagicLinkToken(tokenHash: string): Promise<
  | (MagicLinkTokenRecord & {
      contractor: { id: string; name: string; contact_email: string | null };
      company: { id: string; name: string; slug: string };
    })
  | null
> {
  try {
    const now = new Date();
    // eslint-disable-next-line security-guardrails/require-company-id -- public token consumption by unique token hash
    const consumeResult = await publicDb.magicLinkToken.updateMany({
      where: {
        token_hash: tokenHash,
        used_at: null,
        expires_at: { gt: now },
      },
      data: { used_at: now },
    });

    if (consumeResult.count === 0) return null;

    // allowlisted public lookup by unique token hash after successful consume
    // eslint-disable-next-line security-guardrails/require-company-id -- public lookup by token hash
    const token = await publicDb.magicLinkToken.findFirst({
      where: { token_hash: tokenHash },
      include: {
        contractor: {
          select: { id: true, name: true, contact_email: true },
        },
        company: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!token) return null;
    return token;
  } catch (error) {
    handlePrismaError(error, "MagicLinkToken");
  }
}
