import { describe, it, expect } from "vitest";
import { validateFileMagicNumber } from "./validation";

describe("File Magic Number Validation", () => {
  it("should validate a correct PDF file", async () => {
    // %PDF-1.7...
    const buffer = Buffer.from("255044462d312e370a", "hex");
    const isValid = await validateFileMagicNumber(buffer, ".pdf");
    expect(isValid).toBe(true);
  });

  it("should invalidate a .pdf file with .exe headers (MZ)", async () => {
    // MZ... (Windows Executable)
    const buffer = Buffer.from("4d5a900003000000", "hex");
    const isValid = await validateFileMagicNumber(buffer, ".pdf");
    expect(isValid).toBe(false);
  });

  it("should validate a correct PNG file", async () => {
    const buffer = Buffer.from("89504e470d0a1a0a", "hex");
    const isValid = await validateFileMagicNumber(buffer, ".png");
    expect(isValid).toBe(true);
  });

  it("should invalidate a file with unknown extension", async () => {
    const buffer = Buffer.from("12345678", "hex");
    const isValid = await validateFileMagicNumber(buffer, ".unknown");
    expect(isValid).toBe(false);
  });

  it("should be case-insensitive for extensions", async () => {
    const buffer = Buffer.from("25504446", "hex");
    const isValid = await validateFileMagicNumber(buffer, ".PDF");
    expect(isValid).toBe(true);
  });
});
