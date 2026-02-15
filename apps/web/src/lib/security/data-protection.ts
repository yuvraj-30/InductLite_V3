import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto";

const ENCRYPTION_PREFIX = "enc:v1:";
const IV_LENGTH = 12; // Recommended length for AES-GCM.
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer | null {
  const raw = process.env.DATA_ENCRYPTION_KEY?.trim();
  if (!raw) return null;

  // Derive a fixed-size key from the configured secret.
  return createHash("sha256").update(raw, "utf8").digest();
}

export function isDataEncryptionEnabled(): boolean {
  return Boolean(getEncryptionKey());
}

export function isEncryptedValue(value: string): boolean {
  return value.startsWith(ENCRYPTION_PREFIX);
}

export function encryptString(value: string): string {
  if (!value) return value;
  if (isEncryptedValue(value)) return value;

  const key = getEncryptionKey();
  if (!key) return value;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const payload = Buffer.concat([iv, authTag, ciphertext]).toString("base64url");
  return `${ENCRYPTION_PREFIX}${payload}`;
}

export function decryptString(value: string): string {
  if (!value || !isEncryptedValue(value)) return value;

  const key = getEncryptionKey();
  if (!key) return value;

  try {
    const encoded = value.slice(ENCRYPTION_PREFIX.length);
    const payload = Buffer.from(encoded, "base64url");
    const minLength = IV_LENGTH + AUTH_TAG_LENGTH + 1;
    if (payload.length < minLength) return value;

    const iv = payload.subarray(0, IV_LENGTH);
    const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");

    return plaintext;
  } catch {
    // Keep reads resilient during migration/rollback windows.
    return value;
  }
}

export function encryptNullableString(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return value ?? null;
  return encryptString(value);
}

export function decryptNullableString(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return value ?? null;
  return decryptString(value);
}

export function encryptJsonValue(value: unknown): unknown {
  if (!isDataEncryptionEnabled()) return value;
  return encryptString(JSON.stringify(value));
}

export function decryptJsonValue<T>(value: unknown): T {
  if (typeof value !== "string") return value as T;
  if (!isEncryptedValue(value)) return value as T;

  const parsed = decryptString(value);
  try {
    return JSON.parse(parsed) as T;
  } catch {
    return value as T;
  }
}

export function hashLookupValue(value: string): string {
  const secret = process.env.DATA_ENCRYPTION_KEY?.trim() || "insecure-default";
  return createHmac("sha256", secret)
    .update(value, "utf8")
    .digest("hex");
}
