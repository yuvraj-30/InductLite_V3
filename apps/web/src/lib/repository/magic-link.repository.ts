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
    // allowlisted public lookup by unique token hash
    // eslint-disable-next-line security-guardrails/require-company-id -- public lookup by token hash
    const token = await publicDb.magicLinkToken.findFirst({
      where: {
        token_hash: tokenHash,
        used_at: null,
        expires_at: { gt: new Date() },
      },
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

    const db = scopedDb(token.company_id);
    await db.magicLinkToken.updateMany({
      where: { company_id: token.company_id, id: token.id },
      data: { used_at: new Date() },
    });

    return token;
  } catch (error) {
    handlePrismaError(error, "MagicLinkToken");
  }
}
