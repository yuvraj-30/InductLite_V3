import { describe, it, expect, vi } from "vitest";
import { generateMagicLinkToken, hashMagicLinkToken } from "../magic-link";

// Mock the repository to avoid database dependency in unit tests
vi.mock("@/lib/repository/magic-link.repository", () => ({
  createMagicLinkToken: vi.fn(),
  consumeMagicLinkToken: vi.fn(),
}));

describe("Magic Link Flow", () => {
  it("should generate a secure token and correctly hash it", () => {
    const token = generateMagicLinkToken();
    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThan(32);

    const hash1 = hashMagicLinkToken(token);
    const hash2 = hashMagicLinkToken(token);

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(token);
  });

  it("should produce unique tokens", () => {
    const token1 = generateMagicLinkToken();
    const token2 = generateMagicLinkToken();
    expect(token1).not.toBe(token2);
  });
});
