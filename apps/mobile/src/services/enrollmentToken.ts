import { Buffer } from "buffer";
import {
  mobileEnrollmentTokenPayloadSchema,
  type MobileEnrollmentTokenPayload,
} from "@inductlite/shared";

export type EnrollmentTokenPayload = MobileEnrollmentTokenPayload;

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
    const parsed = mobileEnrollmentTokenPayloadSchema.safeParse(
      JSON.parse(raw) as unknown,
    );

    return parsed.success ? parsed.data : null;
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
