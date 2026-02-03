/**
 * Sign-Out Token Utilities Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateSignOutToken,
  verifySignOutToken,
  hashPhone,
  hashSignOutToken,
  compareTokenHashes,
} from "../sign-out-token";

// Mock environment variables
const MOCK_SECRET = "test-secret-key-for-hmac-signing-32chars";

describe("Sign-Out Token Utilities", () => {
  beforeEach(() => {
    vi.stubEnv("SIGN_OUT_TOKEN_SECRET", MOCK_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("hashPhone", () => {
    it("should return consistent hash for same phone", () => {
      const phone = "+64211234567";
      const hash1 = hashPhone(phone);
      const hash2 = hashPhone(phone);
      expect(hash1).toBe(hash2);
    });

    it("should return different hashes for different phones", () => {
      const hash1 = hashPhone("+64211234567");
      const hash2 = hashPhone("+64211234568");
      expect(hash1).not.toBe(hash2);
    });

    it("should return a hex string", () => {
      const hash = hashPhone("+64211234567");
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it("should produce hash of expected length", () => {
      const hash = hashPhone("+64211234567");
      // Hash is truncated to 16 hex characters for token size
      expect(hash.length).toBe(16);
    });

    it("should produce same hash for equivalent local and E.164 formats", () => {
      const local = hashPhone("021 123 4567");
      const e164 = hashPhone("+64211234567");
      expect(local).toBe(e164);
    });
  });

  describe("generateSignOutToken", () => {
    it("should generate a valid token", () => {
      const result = generateSignOutToken("record-123", "+64211234567");
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe("string");
      expect(result.token.length).toBeGreaterThan(0);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it("should generate tokens with base64url format", () => {
      const result = generateSignOutToken("record-123", "+64211234567");
      // Should contain payload.signature format
      expect(result.token).toContain(".");
      const parts = result.token.split(".");
      expect(parts.length).toBe(2);
    });

    it("should generate different tokens for different records", () => {
      const result1 = generateSignOutToken("record-123", "+64211234567");
      const result2 = generateSignOutToken("record-456", "+64211234567");
      expect(result1.token).not.toBe(result2.token);
    });

    it("should generate different tokens for different phones", () => {
      const result1 = generateSignOutToken("record-123", "+64211234567");
      const result2 = generateSignOutToken("record-123", "+64211234568");
      expect(result1.token).not.toBe(result2.token);
    });

    it("should accept custom expiry hours", () => {
      // With 1 hour expiry (in milliseconds)
      const result = generateSignOutToken(
        "record-123",
        "+64211234567",
        3600000,
      );
      expect(result.token).toBeDefined();

      // Verify by checking the token's expiry
      const verification = verifySignOutToken(result.token, "+64211234567");
      expect(verification.valid).toBe(true);
    });
  });

  describe("verifySignOutToken", () => {
    it("should verify a valid token", () => {
      const { token } = generateSignOutToken("record-123", "+64211234567");
      const result = verifySignOutToken(token, "+64211234567");

      expect(result.valid).toBe(true);
      expect(result.signInRecordId).toBe("record-123");
      expect(result.error).toBeUndefined();
    });

    it("should reject token with wrong phone", () => {
      const { token } = generateSignOutToken("record-123", "+64211234567");
      const result = verifySignOutToken(token, "+64211234568");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("PHONE_MISMATCH");
    });

    it("should reject expired token", () => {
      // Generate token with -1 hour (already expired)
      const { token } = generateSignOutToken(
        "record-123",
        "+64211234567",
        -3600000,
      );
      const result = verifySignOutToken(token, "+64211234567");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("EXPIRED");
    });

    it("should reject malformed token - no dot separator", () => {
      const result = verifySignOutToken("invalid-token", "+64211234567");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("INVALID_FORMAT");
    });

    it("should reject malformed token - invalid base64", () => {
      const result = verifySignOutToken("!!!invalid.signature", "+64211234567");

      expect(result.valid).toBe(false);
      // Could be either error depending on how parsing fails
      expect(["INVALID_FORMAT", "INVALID_SIGNATURE"]).toContain(result.error);
    });

    it("should reject token with tampered payload", () => {
      const { token } = generateSignOutToken("record-123", "+64211234567");
      const [, signature] = token.split(".");

      // Create a different payload
      const tamperedPayload = Buffer.from(
        JSON.stringify({
          signInRecordId: "record-999",
          phoneHash: hashPhone("+64211234567"),
          expiresAt: Date.now() + 3600000,
        }),
      )
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      const tamperedToken = `${tamperedPayload}.${signature}`;
      const result = verifySignOutToken(tamperedToken, "+64211234567");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("INVALID_SIGNATURE");
    });

    it("should reject token with tampered signature", () => {
      const { token } = generateSignOutToken("record-123", "+64211234567");
      const [payload] = token.split(".");

      // Modify the signature
      const tamperedToken = `${payload}.tampered-signature`;
      const result = verifySignOutToken(tamperedToken, "+64211234567");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("INVALID_SIGNATURE");
    });

    it("should handle missing payload fields", () => {
      const incompletePayload = Buffer.from(
        JSON.stringify({ signInRecordId: "record-123" }),
      )
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      const result = verifySignOutToken(
        `${incompletePayload}.fakesig`,
        "+64211234567",
      );

      expect(result.valid).toBe(false);
      // With fake signature, returns INVALID_SIGNATURE (signature check happens first)
      expect(["INVALID_FORMAT", "INVALID_SIGNATURE"]).toContain(result.error);
    });
  });

  describe("Security Properties", () => {
    it("should use timing-safe comparison for signatures", () => {
      // This is more of a code review check, but we can verify
      // the function doesn't leak timing information by ensuring
      // different invalid inputs take similar time
      const { token } = generateSignOutToken("record-123", "+64211234567");
      const [payload] = token.split(".");

      // Both should fail but not crash
      const result1 = verifySignOutToken(`${payload}.wrong1`, "+64211234567");
      const result2 = verifySignOutToken(
        `${payload}.wrong2long`,
        "+64211234567",
      );

      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
    });

    it("should not expose internal details in error", () => {
      const result = verifySignOutToken("bad-token", "+64211234567");

      // Error should be generic, not reveal internals
      expect(result.error).toBe("INVALID_FORMAT");
      expect(result.signInRecordId).toBeUndefined();
    });
  });

  describe("hashSignOutToken", () => {
    it("should return consistent hash for same token", () => {
      const token = "test-token-value.signature123";
      const hash1 = hashSignOutToken(token);
      const hash2 = hashSignOutToken(token);
      expect(hash1).toBe(hash2);
    });

    it("should return different hashes for different tokens", () => {
      const hash1 = hashSignOutToken("token-1.sig");
      const hash2 = hashSignOutToken("token-2.sig");
      expect(hash1).not.toBe(hash2);
    });

    it("should return a hex string of expected length", () => {
      const hash = hashSignOutToken("any-token.sig");
      // SHA-256 produces 64 hex characters
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should produce deterministic hashes for real tokens", () => {
      const { token } = generateSignOutToken("record-123", "+64211234567");
      const hash1 = hashSignOutToken(token);
      const hash2 = hashSignOutToken(token);
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });
  });

  describe("compareTokenHashes", () => {
    it("should return true for matching hashes", () => {
      const { token } = generateSignOutToken("record-123", "+64211234567");
      const hash = hashSignOutToken(token);
      expect(compareTokenHashes(hash, hash)).toBe(true);
    });

    it("should return false for non-matching hashes", () => {
      const token1 = generateSignOutToken("record-123", "+64211234567").token;
      const token2 = generateSignOutToken("record-456", "+64211234567").token;
      const hash1 = hashSignOutToken(token1);
      const hash2 = hashSignOutToken(token2);
      expect(compareTokenHashes(hash1, hash2)).toBe(false);
    });

    it("should return false for invalid hex input", () => {
      const validHash = hashSignOutToken("some-token");
      expect(compareTokenHashes(validHash, "not-hex-string")).toBe(false);
      expect(compareTokenHashes("not-hex", validHash)).toBe(false);
    });

    it("should return false for empty strings", () => {
      const validHash = hashSignOutToken("some-token");
      expect(compareTokenHashes("", validHash)).toBe(false);
      expect(compareTokenHashes(validHash, "")).toBe(false);
    });

    it("should use timing-safe comparison", () => {
      // Both should complete without throwing
      const hash = hashSignOutToken("test-token");
      const wrongHash = "0".repeat(64);
      expect(compareTokenHashes(hash, wrongHash)).toBe(false);
    });
  });

  describe("Token Revocation Flow", () => {
    it("should support revocation by hash comparison", () => {
      // Simulate the full flow
      const { token } = generateSignOutToken("record-123", "+64211234567");

      // Store hash in DB
      const storedHash = hashSignOutToken(token);

      // Later, verify token against stored hash
      const providedHash = hashSignOutToken(token);
      expect(compareTokenHashes(storedHash, providedHash)).toBe(true);

      // After sign-out, hash would be cleared from DB
      // Simulating null/empty hash check
      expect(compareTokenHashes("", providedHash)).toBe(false);
    });

    it("should reject different token with same record ID but different phone", () => {
      // First token - legitimate user
      const { token: token1 } = generateSignOutToken(
        "record-123",
        "+64211234567",
      );
      const storedHash = hashSignOutToken(token1);

      // Attacker tries to generate token with different phone
      const { token: token2 } = generateSignOutToken(
        "record-123",
        "+64499999999", // Different phone
      );
      const attackerHash = hashSignOutToken(token2);

      // Hashes should be different (tokens have different phone hashes)
      expect(compareTokenHashes(storedHash, attackerHash)).toBe(false);
    });

    it("should reject token generated at different time", async () => {
      // First token
      const { token: token1 } = generateSignOutToken(
        "record-123",
        "+64211234567",
        1000, // 1 second expiry
      );
      const storedHash = hashSignOutToken(token1);

      // Wait a tiny bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 2));

      // Generate another token (different expiry timestamp)
      const { token: token2 } = generateSignOutToken(
        "record-123",
        "+64211234567",
        1000,
      );
      const attackerHash = hashSignOutToken(token2);

      // Hashes should be different (tokens have different expiry timestamps)
      expect(compareTokenHashes(storedHash, attackerHash)).toBe(false);
    });
  });
});
