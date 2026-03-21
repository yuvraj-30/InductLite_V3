/**
 * Magic Link Repository
 *
 * Handles magic link token persistence and consumption.
 */

import { scopedDb } from "@/lib/db/scoped-db";
import {
  consumeMagicLinkTokenByHash,
  findMagicLinkTokenByHash,
} from "@/lib/db/scoped";
import { handlePrismaError, requireCompanyId } from "./base";
import { decryptNullableString } from "@/lib/security/data-protection";

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
    const consumeResult = await consumeMagicLinkTokenByHash(tokenHash, now);

    if (consumeResult.count === 0) return null;

    const token = await findMagicLinkTokenByHash(tokenHash);

    if (!token) return null;
    return {
      ...token,
      contractor: {
        ...token.contractor,
        contact_email: decryptNullableString(token.contractor.contact_email),
      },
    };
  } catch (error) {
    handlePrismaError(error, "MagicLinkToken");
  }
}
