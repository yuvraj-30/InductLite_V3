import crypto from "crypto";
import { authenticator } from "otplib";

const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const raw = process.env.MFA_ENCRYPTION_KEY || "";
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error("MFA_ENCRYPTION_KEY must be 32 bytes base64-encoded");
  }
  return key;
}

export function encryptTotpSecret(secret: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), encrypted.toString("base64"), tag.toString("base64")].join(".");
}

export function decryptTotpSecret(payload: string): string | null {
  const key = getEncryptionKey();
  const parts = payload.split(".");
  if (parts.length !== 3) return null;
  const [ivRaw, encryptedRaw, tagRaw] = parts;
  if (!ivRaw || !encryptedRaw || !tagRaw) return null;

  try {
    const iv = Buffer.from(ivRaw, "base64");
    const encrypted = Buffer.from(encryptedRaw, "base64");
    const tag = Buffer.from(tagRaw, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const normalized = code.replace(/\s+/g, "");
  if (!/^[0-9]{6}$/.test(normalized)) return false;
  return authenticator.check(normalized, secret);
}
