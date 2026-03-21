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
export type AllowedMimeType =
  (typeof ALLOWED_FILE_TYPES)[AllowedExtension]["mime"];

export interface SniffedFileType {
  extension: AllowedExtension;
  mime: AllowedMimeType;
}

function normalizeExtension(value: string): string {
  return value.trim().toLowerCase().replace(/^\./, "");
}

/**
 * Resolve a supported file extension from a MIME type.
 */
export function extensionFromMimeType(
  mimeType: string,
): AllowedExtension | null {
  const normalized = mimeType.trim().toLowerCase();
  const entry = Object.entries(ALLOWED_FILE_TYPES).find(
    ([, config]) => config.mime === normalized,
  );
  return (entry?.[0] as AllowedExtension | undefined) ?? null;
}

export function extensionFromFileName(fileName: string): AllowedExtension | null {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex < 0 || lastDotIndex === fileName.length - 1) {
    return null;
  }

  const extension = normalizeExtension(fileName.slice(lastDotIndex + 1));
  return ALLOWED_FILE_TYPES[extension as AllowedExtension]
    ? (extension as AllowedExtension)
    : null;
}

export function sniffFileTypeFromBytes(buffer: Buffer): SniffedFileType | null {
  for (const [extension, config] of Object.entries(ALLOWED_FILE_TYPES)) {
    const bytesToRead = config.magic.length / 2;
    const hex = buffer.toString("hex", 0, bytesToRead).toLowerCase();
    if (hex === config.magic.toLowerCase()) {
      return {
        extension: extension as AllowedExtension,
        mime: config.mime,
      };
    }
  }

  return null;
}

/**
 * Validates a file buffer against its expected extension magic number.
 */
export async function validateFileMagicNumber(
  buffer: Buffer,
  expectedExtension: string,
): Promise<boolean> {
  const ext = normalizeExtension(expectedExtension) as AllowedExtension;
  const config = ALLOWED_FILE_TYPES[ext];

  if (!config) {
    return false;
  }

  const hex = buffer.toString("hex", 0, config.magic.length / 2).toLowerCase();
  return hex === config.magic.toLowerCase();
}
