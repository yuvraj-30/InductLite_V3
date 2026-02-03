/**
 * NZ Time / Expiry Logic Tests
 *
 * Tests for token expiry and date handling across timezone boundaries.
 * Ensures sign-out tokens don't expire prematurely due to UTC vs Pacific/Auckland.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateSignOutToken,
  verifySignOutToken,
} from "../auth/sign-out-token";

const MOCK_SECRET = "test-secret-key-for-hmac-signing-32chars";

describe("NZ Time / Expiry Logic", () => {
  beforeEach(() => {
    vi.stubEnv("SIGN_OUT_TOKEN_SECRET", MOCK_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  describe("Token Expiry Boundaries", () => {
    it("should not expire token before expiry time", () => {
      const { token, expiresAt } = generateSignOutToken(
        "record-123",
        "+64211234567",
        3600000, // 1 hour
      );

      // Verify immediately
      const result = verifySignOutToken(token, "+64211234567");
      expect(result.valid).toBe(true);
      expect(result.signInRecordId).toBe("record-123");

      // Verify expiry is in the future
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("should expire token after expiry time", () => {
      // Create token that expired 1 second ago
      const { token } = generateSignOutToken(
        "record-123",
        "+64211234567",
        -1000, // -1 second (already expired)
      );

      const result = verifySignOutToken(token, "+64211234567");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("EXPIRED");
    });

    it("should handle token at exact expiry boundary", () => {
      // Use fake timers for precise control
      vi.useFakeTimers();
      const now = new Date("2025-01-26T12:00:00Z").getTime();
      vi.setSystemTime(now);

      // Create token expiring in exactly 1 hour
      const { token } = generateSignOutToken(
        "record-123",
        "+64211234567",
        3600000,
      );

      // Just before expiry - should be valid
      vi.setSystemTime(now + 3600000 - 1);
      let result = verifySignOutToken(token, "+64211234567");
      expect(result.valid).toBe(true);

      // At expiry - should be expired (greater than check)
      vi.setSystemTime(now + 3600000 + 1);
      result = verifySignOutToken(token, "+64211234567");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("EXPIRED");
    });
  });

  describe("Midnight Edge Cases", () => {
    it("should handle token generated just before midnight UTC", () => {
      vi.useFakeTimers();
      // 23:59:00 UTC on Jan 26
      const beforeMidnight = new Date("2025-01-26T23:59:00Z").getTime();
      vi.setSystemTime(beforeMidnight);

      const { token } = generateSignOutToken(
        "record-123",
        "+64211234567",
        3600000, // 1 hour
      );

      // Verify at 00:30 UTC next day (within expiry)
      vi.setSystemTime(new Date("2025-01-27T00:30:00Z").getTime());
      const result = verifySignOutToken(token, "+64211234567");
      expect(result.valid).toBe(true);
    });

    it("should handle token generated just before midnight NZ time", () => {
      vi.useFakeTimers();
      // 23:59 NZ time = 10:59 UTC (NZDT is UTC+13 in summer)
      const nzMidnight = new Date("2025-01-26T10:59:00Z").getTime();
      vi.setSystemTime(nzMidnight);

      const { token } = generateSignOutToken(
        "record-123",
        "+64211234567",
        3600000,
      );

      // 1 hour later in UTC should still be valid
      vi.setSystemTime(new Date("2025-01-26T11:30:00Z").getTime());
      const result = verifySignOutToken(token, "+64211234567");
      expect(result.valid).toBe(true);
    });

    it("should not prematurely expire when crossing UTC midnight", () => {
      vi.useFakeTimers();
      // Create at 23:00 UTC
      vi.setSystemTime(new Date("2025-01-26T23:00:00Z").getTime());

      const { token, expiresAt } = generateSignOutToken(
        "record-123",
        "+64211234567",
        28800000, // 8 hours
      );

      // Expiry should be at 07:00 UTC next day
      expect(expiresAt).toEqual(new Date("2025-01-27T07:00:00Z"));

      // At 02:00 UTC next day - should still be valid
      vi.setSystemTime(new Date("2025-01-27T02:00:00Z").getTime());
      const result = verifySignOutToken(token, "+64211234567");
      expect(result.valid).toBe(true);
    });
  });

  describe("DST Transition Edge Cases (Pacific/Auckland)", () => {
    /**
     * NZ DST transitions:
     * - DST starts: Last Sunday of September (clocks go forward 1 hour)
     * - DST ends: First Sunday of April (clocks go back 1 hour)
     *
     * These tests ensure token expiry works correctly regardless of
     * whether the server or client is in NZ timezone.
     */

    it("should handle 8-hour token across DST start (September)", () => {
      vi.useFakeTimers();
      // DST typically starts around 2:00 AM last Sunday of September
      // 2025-09-28 01:00 NZST (UTC+12) = 2025-09-27T13:00:00Z
      vi.setSystemTime(new Date("2025-09-27T13:00:00Z").getTime());

      const { token, expiresAt } = generateSignOutToken(
        "record-123",
        "+64211234567",
        28800000, // 8 hours
      );

      // Expiry should be 8 hours from now in UTC, unaffected by DST
      expect(expiresAt).toEqual(new Date("2025-09-27T21:00:00Z"));

      // 7 hours later - should still be valid
      vi.setSystemTime(new Date("2025-09-27T20:00:00Z").getTime());
      const result = verifySignOutToken(token, "+64211234567");
      expect(result.valid).toBe(true);
    });

    it("should handle 8-hour token across DST end (April)", () => {
      vi.useFakeTimers();
      // DST typically ends around 3:00 AM first Sunday of April
      // 2025-04-06 02:00 NZDT (UTC+13) = 2025-04-05T13:00:00Z
      vi.setSystemTime(new Date("2025-04-05T13:00:00Z").getTime());

      const { token, expiresAt } = generateSignOutToken(
        "record-123",
        "+64211234567",
        28800000, // 8 hours
      );

      // Expiry should be 8 hours from now in UTC
      expect(expiresAt).toEqual(new Date("2025-04-05T21:00:00Z"));

      // Token should remain valid for full 8 hours
      vi.setSystemTime(new Date("2025-04-05T20:59:00Z").getTime());
      let result = verifySignOutToken(token, "+64211234567");
      expect(result.valid).toBe(true);

      // Just past 8 hours - should be expired
      vi.setSystemTime(new Date("2025-04-05T21:00:01Z").getTime());
      result = verifySignOutToken(token, "+64211234567");
      expect(result.valid).toBe(false);
    });

    it("should not add or subtract DST offset from expiry", () => {
      vi.useFakeTimers();
      const start = new Date("2025-06-15T12:00:00Z").getTime(); // Winter in NZ
      vi.setSystemTime(start);

      const { expiresAt } = generateSignOutToken(
        "record-123",
        "+64211234567",
        3600000, // 1 hour
      );

      // Should be exactly 1 hour later in UTC, regardless of NZ timezone
      const expectedExpiry = new Date("2025-06-15T13:00:00Z");
      expect(expiresAt).toEqual(expectedExpiry);
    });
  });

  describe("Long-running Token Validity", () => {
    it("should correctly validate default 8-hour token", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-26T08:00:00Z").getTime());

      const { token } = generateSignOutToken("record-123", "+64211234567");

      // Valid at 4 hours
      vi.setSystemTime(new Date("2025-01-26T12:00:00Z").getTime());
      expect(verifySignOutToken(token, "+64211234567").valid).toBe(true);

      // Valid at 7 hours 59 minutes
      vi.setSystemTime(new Date("2025-01-26T15:59:00Z").getTime());
      expect(verifySignOutToken(token, "+64211234567").valid).toBe(true);

      // Expired at 8 hours 1 second
      vi.setSystemTime(new Date("2025-01-26T16:00:01Z").getTime());
      expect(verifySignOutToken(token, "+64211234567").valid).toBe(false);
    });
  });
});
