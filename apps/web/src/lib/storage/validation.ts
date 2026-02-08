/**
 * Validates file magic numbers (hex headers) to ensure file integrity and security.
 * Prevents extension spoofing (e.g., .exe renamed to .pdf).
 */

export const ALLOWED_FILE_TYPES = {
  pdf: {
    mime: "application/pdf",
    magic: "25504446", // %PDF
  },
  jpg: {
    mime: "image/jpeg",
    magic: "ffd8ff",
  },
  jpeg: {
    mime: "image/jpeg",
    magic: "ffd8ff",
  },
  png: {
    mime: "image/png",
    magic: "89504e47",
  },
} as const;

export type AllowedExtension = keyof typeof ALLOWED_FILE_TYPES;

/**
 * Validates a file buffer against its expected extension magic number.
 */
export async function validateFileMagicNumber(
  buffer: Buffer,
  expectedExtension: string,
): Promise<boolean> {
  const ext = expectedExtension
    .toLowerCase()
    .replace(".", "") as AllowedExtension;
  const config = ALLOWED_FILE_TYPES[ext];

  if (!config) {
    return false;
  }

  const hex = buffer.toString("hex", 0, config.magic.length / 2).toLowerCase();
  return hex === config.magic.toLowerCase();
}
