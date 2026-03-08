import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateMobileEnrollmentToken,
  parseBearerToken,
  verifyMobileEnrollmentToken,
} from "../enrollment-token";

describe("mobile enrollment token", () => {
  const originalSessionSecret = process.env.SESSION_SECRET;
  const originalEnrollmentSecret = process.env.MOBILE_ENROLLMENT_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-123";
    process.env.MOBILE_ENROLLMENT_SECRET = "test-mobile-enrollment-secret-123";
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSessionSecret;
    process.env.MOBILE_ENROLLMENT_SECRET = originalEnrollmentSecret;
    vi.useRealTimers();
  });

  it("generates and verifies a valid token", () => {
    const generated = generateMobileEnrollmentToken({
      companyId: "company-1",
      siteId: "cm0000000000000000000001",
      endpoint: "https://push.example.test/sub/1",
      deviceId: "sub-1",
      runtime: "ios-native",
      tokenVersion: 2,
      visitorName: "Ari Contractor",
      visitorPhone: "0211234567",
      visitorEmail: "ARI@example.test",
      employerName: "Acme",
      visitorType: "EMPLOYEE",
      expiresInMinutes: 30,
    });

    const verified = verifyMobileEnrollmentToken(generated.token);
    expect(verified.valid).toBe(true);
    if (verified.valid) {
      expect(verified.payload.companyId).toBe("company-1");
      expect(verified.payload.siteId).toBe("cm0000000000000000000001");
      expect(verified.payload.visitorPhone).toMatch(/^\+/);
      expect(verified.payload.visitorEmail).toBe("ari@example.test");
      expect(verified.payload.visitorType).toBe("EMPLOYEE");
      expect(verified.payload.deviceId).toBe("sub-1");
      expect(verified.payload.tokenVersion).toBe(2);
    }
  });

  it("rejects invalid signatures", () => {
    const generated = generateMobileEnrollmentToken({
      companyId: "company-1",
      siteId: "cm0000000000000000000001",
      endpoint: "https://push.example.test/sub/1",
      deviceId: "sub-1",
      runtime: "ios-native",
      tokenVersion: 1,
      visitorName: "Ari Contractor",
      visitorPhone: "0211234567",
      visitorType: "EMPLOYEE",
    });
    const tampered = `${generated.token}x`;

    const verified = verifyMobileEnrollmentToken(tampered);
    expect(verified.valid).toBe(false);
    if (!verified.valid) {
      expect(verified.error).toBe("INVALID_SIGNATURE");
    }
  });

  it("returns expired when current time is beyond token expiry", () => {
    vi.useFakeTimers();
    const now = new Date("2026-03-07T00:00:00.000Z");
    vi.setSystemTime(now);

    const generated = generateMobileEnrollmentToken({
      companyId: "company-1",
      siteId: "cm0000000000000000000001",
      endpoint: "https://push.example.test/sub/1",
      deviceId: "sub-1",
      runtime: "ios-native",
      tokenVersion: 1,
      visitorName: "Ari Contractor",
      visitorPhone: "0211234567",
      visitorType: "EMPLOYEE",
      expiresInMinutes: 15,
    });

    vi.setSystemTime(new Date(generated.expiresAt.getTime() + 1000));
    const verified = verifyMobileEnrollmentToken(generated.token);
    expect(verified.valid).toBe(false);
    if (!verified.valid) {
      expect(verified.error).toBe("EXPIRED");
    }
  });

  it("parses bearer tokens", () => {
    expect(parseBearerToken("Bearer abc123")).toBe("abc123");
    expect(parseBearerToken("bearer abc123")).toBe("abc123");
    expect(parseBearerToken("Token abc123")).toBeNull();
    expect(parseBearerToken(null)).toBeNull();
  });
});
