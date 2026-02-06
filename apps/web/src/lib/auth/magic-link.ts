import crypto from "crypto";
import {
  createMagicLinkToken,
  consumeMagicLinkToken,
} from "@/lib/repository/magic-link.repository";

const MAGIC_LINK_TTL_MINUTES = 15;

export function generateMagicLinkToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashMagicLinkToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createMagicLinkForContractor(
  companyId: string,
  contractorId: string,
): Promise<string> {
  const token = generateMagicLinkToken();
  const tokenHash = hashMagicLinkToken(token);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000);

  await createMagicLinkToken(companyId, contractorId, tokenHash, expiresAt);

  return token;
}

export async function consumeMagicLink(token: string): Promise<{
  contractor: { id: string; name: string; contact_email: string | null };
  company: { id: string; name: string; slug: string };
} | null> {
  const tokenHash = hashMagicLinkToken(token);
  const result = await consumeMagicLinkToken(tokenHash);
  if (!result) return null;

  return {
    contractor: result.contractor,
    company: result.company,
  };
}
