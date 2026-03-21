import { describe, test, expect } from "vitest";
import {
  extensionsFromMimeType,
  extensionFromFileName,
  sniffFileTypeFromBytes,
  validateFileMagicNumber,
} from "../validation";

describe("File Magic Number Validation", () => {
  test("should validate a correct PDF file", async () => {
    // %PDF-1.7...
    const buffer = Buffer.from("255044462d312e370a", "hex");
    const isValid = await validateFileMagicNumber(buffer, ".pdf");
    expect(isValid).toBe(true);
  });

  test("should invalidate a .pdf file with .exe headers (MZ)", async () => {
    // MZ... (Windows Executable)
    const buffer = Buffer.from("4d5a900003000000", "hex");
    const isValid = await validateFileMagicNumber(buffer, ".pdf");
    expect(isValid).toBe(false);
  });

  test("should validate a correct PNG file", async () => {
    const buffer = Buffer.from("89504e470d0a1a0a", "hex");
    const isValid = await validateFileMagicNumber(buffer, ".png");
    expect(isValid).toBe(true);
  });

  test("should invalidate a file with unknown extension", async () => {
    const buffer = Buffer.from("12345678", "hex");
    const isValid = await validateFileMagicNumber(buffer, ".unknown");
    expect(isValid).toBe(false);
  });

  test("should be case-insensitive for extensions", async () => {
    const buffer = Buffer.from("25504446", "hex");
    const isValid = await validateFileMagicNumber(buffer, ".PDF");
    expect(isValid).toBe(true);
  });

  test("should derive the file type from bytes on the server", () => {
    const buffer = Buffer.from("89504e470d0a1a0a", "hex");
    expect(sniffFileTypeFromBytes(buffer)).toEqual({
      extension: "png",
      mime: "image/png",
    });
  });

  test("should return every supported extension for a MIME type", () => {
    expect(extensionsFromMimeType("image/jpeg")).toEqual(["jpg", "jpeg"]);
  });

  test("should reject filenames without a supported extension", () => {
    expect(extensionFromFileName("document")).toBeNull();
    expect(extensionFromFileName("evidence.exe")).toBeNull();
  });
});
