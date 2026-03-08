import { createHmac, timingSafeEqual } from "crypto";
import { formatToE164 } from "@inductlite/shared";
import type { VisitorType } from "@prisma/client";

export interface GenerateMobileEnrollmentTokenInput {
  companyId: string;
  siteId: string;
  endpoint: string;
  deviceId: string;
  runtime: string;
  tokenVersion: number;
  visitorName: string;
  visitorPhone: string;
  visitorEmail?: string | null;
  employerName?: string | null;
  visitorType: VisitorType;
  expiresInMinutes?: number;
}

export interface MobileEnrollmentTokenPayload {
  version: 1;
  companyId: string;
  siteId: string;
  endpoint: string;
  deviceId: string;
  runtime: string;
  tokenVersion: number;
  nonce: string;
  visitorName: string;
  visitorPhone: string;
  visitorEmail: string | null;
  employerName: string | null;
  visitorType: VisitorType;
  issuedAt: number;
  expiresAt: number;
}

export type VerifyMobileEnrollmentTokenResult =
  | { valid: true; payload: MobileEnrollmentTokenPayload }
  | {
      valid: false;
      error:
        | "INVALID_FORMAT"
        | "INVALID_SIGNATURE"
        | "INVALID_PAYLOAD"
        | "EXPIRED";
    };

const DEFAULT_EXPIRY_MINUTES = 60 * 24 * 30; // 30 days

function getEnrollmentSecret(): string {
  const secret =
    process.env.MOBILE_ENROLLMENT_SECRET ||
    process.env.SIGN_OUT_TOKEN_SECRET ||
    process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "MOBILE_ENROLLMENT_SECRET or SIGN_OUT_TOKEN_SECRET or SESSION_SECRET must be configured",
    );
  }
  return secret;
}

function normalizePhone(input: string): string {
  const normalized = formatToE164(input, "NZ");
  if (!normalized) {
    throw new Error("Invalid phone number");
  }
  return normalized;
}

function parsePayload(value: unknown): MobileEnrollmentTokenPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    record.version !== 1 ||
    typeof record.companyId !== "string" ||
    typeof record.siteId !== "string" ||
    typeof record.endpoint !== "string" ||
    typeof record.deviceId !== "string" ||
    typeof record.runtime !== "string" ||
    typeof record.tokenVersion !== "number" ||
    typeof record.nonce !== "string" ||
    typeof record.visitorName !== "string" ||
    typeof record.visitorPhone !== "string" ||
    typeof record.visitorType !== "string" ||
    typeof record.issuedAt !== "number" ||
    typeof record.expiresAt !== "number"
  ) {
    return null;
  }

  const visitorType = record.visitorType.trim().toUpperCase();
  if (
    visitorType !== "CONTRACTOR" &&
    visitorType !== "VISITOR" &&
    visitorType !== "EMPLOYEE" &&
    visitorType !== "DELIVERY"
  ) {
    return null;
  }

  return {
    version: 1,
    companyId: record.companyId.trim(),
    siteId: record.siteId.trim(),
    endpoint: record.endpoint.trim(),
    deviceId: record.deviceId.trim(),
    runtime: record.runtime.trim(),
    tokenVersion: Math.max(1, Math.trunc(record.tokenVersion)),
    nonce: record.nonce.trim(),
    visitorName: record.visitorName.trim(),
    visitorPhone: record.visitorPhone.trim(),
    visitorEmail:
      typeof record.visitorEmail === "string" && record.visitorEmail.trim()
        ? record.visitorEmail.trim().toLowerCase()
        : null,
    employerName:
      typeof record.employerName === "string" && record.employerName.trim()
        ? record.employerName.trim()
        : null,
    visitorType: visitorType as VisitorType,
    issuedAt: Math.trunc(record.issuedAt),
    expiresAt: Math.trunc(record.expiresAt),
  };
}

export function generateMobileEnrollmentToken(
  input: GenerateMobileEnrollmentTokenInput,
): { token: string; expiresAt: Date; payload: MobileEnrollmentTokenPayload } {
  const expiresInMinutes = Math.max(
    15,
    Math.min(input.expiresInMinutes ?? DEFAULT_EXPIRY_MINUTES, 60 * 24 * 90),
  );
  const issuedAt = Date.now();
  const expiresAt = issuedAt + expiresInMinutes * 60 * 1000;

  const payload: MobileEnrollmentTokenPayload = {
    version: 1,
    companyId: input.companyId.trim(),
    siteId: input.siteId.trim(),
    endpoint: input.endpoint.trim(),
    deviceId: input.deviceId.trim(),
    runtime: input.runtime.trim().slice(0, 120),
    tokenVersion: Math.max(1, Math.trunc(input.tokenVersion)),
    nonce: Buffer.from(`${Date.now()}:${input.endpoint}:${Math.random()}`)
      .toString("base64url")
      .slice(0, 48),
    visitorName: input.visitorName.trim(),
    visitorPhone: normalizePhone(input.visitorPhone),
    visitorEmail: input.visitorEmail?.trim().toLowerCase() || null,
    employerName: input.employerName?.trim() || null,
    visitorType: input.visitorType,
    issuedAt,
    expiresAt,
  };

  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getEnrollmentSecret())
    .update(payloadEncoded)
    .digest("base64url");
  return {
    token: `${payloadEncoded}.${signature}`,
    expiresAt: new Date(expiresAt),
    payload,
  };
}

export function verifyMobileEnrollmentToken(
  token: string,
): VerifyMobileEnrollmentTokenResult {
  const [payloadEncoded, signature] = token.split(".");
  if (!payloadEncoded || !signature) {
    return { valid: false, error: "INVALID_FORMAT" };
  }

  const expectedSignature = createHmac("sha256", getEnrollmentSecret())
    .update(payloadEncoded)
    .digest("base64url");

  try {
    const providedBuffer = Buffer.from(signature, "base64url");
    const expectedBuffer = Buffer.from(expectedSignature, "base64url");
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      return { valid: false, error: "INVALID_SIGNATURE" };
    }
  } catch {
    return { valid: false, error: "INVALID_SIGNATURE" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(
      Buffer.from(payloadEncoded, "base64url").toString("utf8"),
    ) as unknown;
  } catch {
    return { valid: false, error: "INVALID_FORMAT" };
  }

  const payload = parsePayload(parsed);
  if (!payload) {
    return { valid: false, error: "INVALID_PAYLOAD" };
  }
  if (Date.now() > payload.expiresAt) {
    return { valid: false, error: "EXPIRED" };
  }

  return { valid: true, payload };
}

export function parseBearerToken(header: string | null): string | null {
  const raw = (header ?? "").trim();
  if (!raw) return null;
  const [scheme, token] = raw.split(/\s+/, 2);
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}
