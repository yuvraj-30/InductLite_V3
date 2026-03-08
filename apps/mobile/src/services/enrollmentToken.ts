import { Buffer } from "buffer";

export interface EnrollmentTokenPayload {
  version: 1;
  companyId: string;
  siteId: string;
  endpoint: string;
  visitorName: string;
  visitorPhone: string;
  visitorEmail: string | null;
  employerName: string | null;
  visitorType: "CONTRACTOR" | "VISITOR" | "EMPLOYEE" | "DELIVERY";
  issuedAt: number;
  expiresAt: number;
}

function decodeBase64Url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
  return Buffer.from(padded, "base64").toString("utf8");
}

export function parseEnrollmentTokenPayload(
  token: string,
): EnrollmentTokenPayload | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const [payloadEncoded] = trimmed.split(".", 2);
  if (!payloadEncoded) return null;

  try {
    const raw = decodeBase64Url(payloadEncoded);
    const parsed = JSON.parse(raw) as Partial<EnrollmentTokenPayload>;

    if (
      parsed.version !== 1 ||
      typeof parsed.companyId !== "string" ||
      typeof parsed.siteId !== "string" ||
      typeof parsed.endpoint !== "string" ||
      typeof parsed.visitorName !== "string" ||
      typeof parsed.visitorPhone !== "string" ||
      typeof parsed.visitorType !== "string" ||
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }

    if (
      parsed.visitorType !== "CONTRACTOR" &&
      parsed.visitorType !== "VISITOR" &&
      parsed.visitorType !== "EMPLOYEE" &&
      parsed.visitorType !== "DELIVERY"
    ) {
      return null;
    }

    return {
      version: 1,
      companyId: parsed.companyId,
      siteId: parsed.siteId,
      endpoint: parsed.endpoint,
      visitorName: parsed.visitorName,
      visitorPhone: parsed.visitorPhone,
      visitorEmail: parsed.visitorEmail ?? null,
      employerName: parsed.employerName ?? null,
      visitorType: parsed.visitorType,
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function isEnrollmentTokenExpired(payload: EnrollmentTokenPayload): boolean {
  return Date.now() > payload.expiresAt;
}

export function formatEnrollmentExpiry(payload: EnrollmentTokenPayload): string {
  return new Date(payload.expiresAt).toLocaleString("en-NZ");
}
