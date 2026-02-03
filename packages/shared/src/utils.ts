/**
 * Shared utility functions for InductLite
 */

/**
 * Generate a URL-safe random slug
 */
export function generateSlug(length: number = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    const v = randomValues[i] ?? 0;
    result += chars[v % chars.length];
  }
  return result;
}

import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Format a phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, "");

  // NZ format: +64 21 123 4567
  if (cleaned.startsWith("+64")) {
    const rest = cleaned.slice(3);
    if (rest.length >= 9) {
      return `+64 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`;
    }
  }

  return phone;
}

/**
 * Validate a phone number using libphonenumber-js (E.164 / international formats)
 */
export function isValidPhoneE164(
  phone: string,
  defaultCountry?: string,
): boolean {
  try {
    const pn = parsePhoneNumberFromString(
      phone,
      defaultCountry as unknown as import("libphonenumber-js").CountryCode,
    );
    return !!pn && pn.isValid();
  } catch {
    return false;
  }
}

/**
 * Format a phone number to E.164 if possible
 */
export function formatToE164(
  phone: string,
  defaultCountry?: string,
): string | null {
  try {
    const pn = parsePhoneNumberFromString(
      phone,
      defaultCountry as unknown as import("libphonenumber-js").CountryCode,
    );
    if (!pn || !pn.isValid()) return null;
    return pn.number; // E.164 formatted
  } catch {
    return null;
  }
}

/**
 * Hash a phone number for token generation (simple hash for demo)
 */
export function hashPhone(phone: string): string {
  // Prefer canonical E.164 when possible (treat local NZ numbers as NZ); fall back to digit-only legacy normalization
  const canonical = formatToE164(phone, "NZ") ?? phone.replace(/[^\d]/g, "");

  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    const char = canonical.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Calculate days until expiry
 */
export function daysUntilExpiry(
  expiryDate: Date | string | null,
): number | null {
  if (!expiryDate) return null;

  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get document status based on expiry date
 */
export function getDocumentStatus(
  expiryDate: Date | string | null,
  warningDays: number = 30,
): "valid" | "expiring" | "expired" | "no-expiry" {
  if (!expiryDate) return "no-expiry";

  const days = daysUntilExpiry(expiryDate);
  if (days === null) return "no-expiry";
  if (days < 0) return "expired";
  if (days <= warningDays) return "expiring";
  return "valid";
}

/**
 * Sanitize string for safe output (basic XSS prevention)
 */
export function sanitizeString(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Format date for display in NZ timezone
 */
export function formatDateNZ(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-NZ", {
    timeZone: "Pacific/Auckland",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format datetime for display in NZ timezone
 */
export function formatDateTimeNZ(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString("en-NZ", {
    timeZone: "Pacific/Auckland",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Calculate duration between two dates
 */
export function formatDuration(
  start: Date | string,
  end: Date | string,
): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}

/**
 * Fuzzy match employer name to contractor name
 */
export function fuzzyMatch(
  employerName: string,
  contractorName: string,
): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const a = normalize(employerName);
  const b = normalize(contractorName);

  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.8;

  // Simple word matching
  const wordsA = a.split(/\s+/);
  const wordsB = b.split(/\s+/);
  const matchingWords = wordsA.filter((w) =>
    wordsB.some((wb) => wb.includes(w) || w.includes(wb)),
  );

  if (matchingWords.length > 0) {
    return (
      (matchingWords.length / Math.max(wordsA.length, wordsB.length)) * 0.6
    );
  }

  return 0;
}
