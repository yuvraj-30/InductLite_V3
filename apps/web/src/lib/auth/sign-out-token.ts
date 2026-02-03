/**
 * Sign-Out Token Utilities
 *
 * Generates and verifies short-lived signed tokens for self-service sign-out.
 * Tokens are bound to:
 * - signInRecordId: The specific sign-in record
 * - phoneHash: Hash of visitor phone for verification
 * - expiry: Short-lived (default 8 hours)
 *
 * Security considerations:
 * - Uses HMAC-SHA256 for signing
 * - Tokens are not stored in database (stateless verification)
 * - Short expiry limits window of attack
 * - Phone hash prevents token reuse for different visitors
 */

import { createHmac, timingSafeEqual } from "crypto";
import { formatToE164 } from "@inductlite/shared";

/**
 * Token payload structure
 */
export interface SignOutTokenPayload {
  signInRecordId: string;
  phoneHash: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

/**
 * Token verification result
 */
export interface TokenVerificationResult {
  valid: boolean;
  signInRecordId?: string;
  error?: "INVALID_FORMAT" | "INVALID_SIGNATURE" | "EXPIRED" | "PHONE_MISMATCH";
}

/**
 * Default token expiry: 8 hours in milliseconds
 */
const DEFAULT_EXPIRY_MS = 8 * 60 * 60 * 1000;

/**
 * Get the signing secret from environment
 */
function getSigningSecret(): string {
  const secret =
    process.env.SIGN_OUT_TOKEN_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SIGN_OUT_TOKEN_SECRET or SESSION_SECRET must be configured",
    );
  }
  return secret;
}

/**
 * Create a hash of the phone number for token binding
 */
export function hashPhone(phone: string): string {
  const secret = getSigningSecret();
  // Normalize to E.164 when possible; fall back to digit-only for legacy values.
  const canonical = formatToE164(phone, "NZ") ?? phone.replace(/\D/g, "");
  return createHmac("sha256", secret)
    .update(canonical)
    .digest("hex")
    .substring(0, 16); // Truncate for token size
}

/**
 * Create a hash of the sign-out token for revocation storage
 * Uses HMAC-SHA256 with server secret for consistency
 *
 * @param token - The full sign-out token
 * @returns Hex-encoded hash for DB storage
 */
export function hashSignOutToken(token: string): string {
  const secret = getSigningSecret();
  return createHmac("sha256", secret).update(token).digest("hex");
}

/**
 * Compare token hashes in a timing-safe manner
 *
 * @param storedHash - The hash stored in DB
 * @param providedHash - The hash of the provided token
 * @returns true if hashes match
 */
export function compareTokenHashes(
  storedHash: string,
  providedHash: string,
): boolean {
  try {
    const storedBuffer = Buffer.from(storedHash, "hex");
    const providedBuffer = Buffer.from(providedHash, "hex");

    if (storedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(storedBuffer, providedBuffer);
  } catch {
    return false;
  }
}

/**
 * Generate a signed sign-out token
 *
 * @param signInRecordId - The sign-in record ID
 * @param phone - The visitor's phone number
 * @param expiryMs - Token expiry in milliseconds (default 8 hours)
 * @returns Base64url-encoded signed token
 */
export function generateSignOutToken(
  signInRecordId: string,
  phone: string,
  expiryMs: number = DEFAULT_EXPIRY_MS,
): { token: string; expiresAt: Date } {
  const secret = getSigningSecret();
  const phoneHash = hashPhone(phone);
  const expiresAt = Date.now() + expiryMs;

  // Create payload
  const payload: SignOutTokenPayload = {
    signInRecordId,
    phoneHash,
    expiresAt,
  };

  // Encode payload as base64url
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");

  // Create signature
  const signature = createHmac("sha256", secret)
    .update(payloadStr)
    .digest("base64url");

  // Combine payload and signature
  const token = `${payloadStr}.${signature}`;

  return {
    token,
    expiresAt: new Date(expiresAt),
  };
}

/**
 * Verify a sign-out token
 *
 * @param token - The token to verify
 * @param phone - The phone number to verify against
 * @returns Verification result with signInRecordId if valid
 */
export function verifySignOutToken(
  token: string,
  phone: string,
): TokenVerificationResult {
  const secret = getSigningSecret();

  // Split token into payload and signature
  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "INVALID_FORMAT" };
  }

  const payloadStr = parts[0];
  const providedSignature = parts[1];

  if (!payloadStr || !providedSignature) {
    return { valid: false, error: "INVALID_FORMAT" };
  }

  // Verify signature
  const expectedSignature = createHmac("sha256", secret)
    .update(payloadStr)
    .digest("base64url");

  // Timing-safe comparison
  try {
    const providedBuffer = Buffer.from(providedSignature, "base64url");
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

  // Decode payload
  let payload: SignOutTokenPayload;
  try {
    const payloadJson = Buffer.from(payloadStr, "base64url").toString("utf-8");
    payload = JSON.parse(payloadJson);
  } catch {
    return { valid: false, error: "INVALID_FORMAT" };
  }

  // Check expiry
  if (Date.now() > payload.expiresAt) {
    return { valid: false, error: "EXPIRED" };
  }

  // Verify phone hash
  const expectedPhoneHash = hashPhone(phone);
  if (payload.phoneHash !== expectedPhoneHash) {
    return { valid: false, error: "PHONE_MISMATCH" };
  }

  return {
    valid: true,
    signInRecordId: payload.signInRecordId,
  };
}

/**
 * Extract signInRecordId from token without full verification
 * Used for looking up the record before full validation
 */
export function extractRecordIdFromToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const payloadPart = parts[0];
    if (!payloadPart) return null;

    const payloadJson = Buffer.from(payloadPart, "base64url").toString("utf-8");
    const payload: SignOutTokenPayload = JSON.parse(payloadJson);
    return payload.signInRecordId;
  } catch {
    return null;
  }
}

/**
 * Check if a token is expired without full verification
 */
export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return true;

    const payloadPart = parts[0];
    if (!payloadPart) return true;

    const payloadJson = Buffer.from(payloadPart, "base64url").toString("utf-8");
    const payload: SignOutTokenPayload = JSON.parse(payloadJson);
    return Date.now() > payload.expiresAt;
  } catch {
    return true;
  }
}
