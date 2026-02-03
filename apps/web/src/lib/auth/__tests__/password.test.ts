/**
 * Password Utility Tests
 */

import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, needsRehash } from "../password";

describe("Password Utilities", () => {
  describe("hashPassword", () => {
    it("should hash a password", async () => {
      const password = "SecureP@ssw0rd!";
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it("should produce different hashes for same password", async () => {
      const password = "SecureP@ssw0rd!";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    }, 20000);
  });

  describe("verifyPassword", () => {
    it("should verify a correct password", async () => {
      const password = "SecureP@ssw0rd!";
      const hash = await hashPassword(password);

      const result = await verifyPassword(hash, password);

      expect(result).toBe(true);
    });

    it("should reject an incorrect password", async () => {
      const password = "SecureP@ssw0rd!";
      const hash = await hashPassword(password);

      const result = await verifyPassword(hash, "WrongPassword");

      expect(result).toBe(false);
    });

    it("should handle empty password", async () => {
      const hash = await hashPassword("SomePassword");

      const result = await verifyPassword(hash, "");

      expect(result).toBe(false);
    });
  });

  describe("needsRehash", () => {
    it("should return false for fresh hash", async () => {
      const hash = await hashPassword("SecureP@ssw0rd!");

      const result = needsRehash(hash);

      expect(result).toBe(false);
    });

    it("should return true for invalid hash format", () => {
      const result = needsRehash("not-a-valid-hash");

      expect(result).toBe(true);
    });

    it("should return true for empty hash", () => {
      const result = needsRehash("");

      expect(result).toBe(true);
    });
  });
});
