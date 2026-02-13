import crypto from "crypto";
import { cookies } from "next/headers";
import { scopedDb } from "@/lib/db/scoped-db";

const COOKIE_NAME = "contractor_magic";
const SESSION_TTL_HOURS = 12;

interface ContractorSessionPayload {
  contractorId: string;
  companyId: string;
  exp: number;
}

function getMagicLinkSecret(): string {
  const secret = process.env.MAGIC_LINK_SECRET || "";
  if (!secret) {
    throw new Error("MAGIC_LINK_SECRET is required for contractor sessions");
  }
  return secret;
}

function base64UrlEncode(input: Buffer | string): string {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

function signPayload(payload: ContractorSessionPayload): string {
  const json = JSON.stringify(payload);
  const encoded = base64UrlEncode(json);
  const signature = crypto
    .createHmac("sha256", getMagicLinkSecret())
    .update(encoded)
    .digest();
  return `${encoded}.${base64UrlEncode(signature)}`;
}

function verifyPayload(token: string): ContractorSessionPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = crypto
    .createHmac("sha256", getMagicLinkSecret())
    .update(encoded)
    .digest();
  const provided = base64UrlDecode(signature);
  if (provided.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(provided, expected)) return null;
  try {
    const payload = JSON.parse(
      base64UrlDecode(encoded).toString("utf8"),
    ) as ContractorSessionPayload;
    if (!payload.contractorId || !payload.companyId || !payload.exp)
      return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setContractorSession(input: {
  contractorId: string;
  companyId: string;
}): Promise<void> {
  const exp = Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000;
  const token = signPayload({
    contractorId: input.contractorId,
    companyId: input.companyId,
    exp,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_HOURS * 60 * 60,
  });
}

export async function getContractorSession(): Promise<{
  contractorId: string;
  companyId: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifyPayload(token);
  if (!payload) return null;

  const db = scopedDb(payload.companyId);
  const contractor = await db.contractor.findFirst({
    where: {
      id: payload.contractorId,
      company_id: payload.companyId,
      is_active: true,
    },
    select: { id: true },
  });
  if (!contractor) return null;

  return { contractorId: payload.contractorId, companyId: payload.companyId };
}
