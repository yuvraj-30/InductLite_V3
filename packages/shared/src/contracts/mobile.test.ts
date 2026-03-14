import { describe, expect, it } from "vitest";
import {
  geofenceEventPayloadSchema,
  heartbeatPayloadSchema,
  mobileEnrollmentTokenPayloadSchema,
} from "./mobile";

describe("packages/shared mobile contracts", () => {
  it("normalizes blank optional geofence fields", () => {
    const parsed = geofenceEventPayloadSchema.parse({
      eventId: "geo_12345678",
      eventType: "ENTRY",
      occurredAt: "",
      endpoint: "   ",
    });

    expect(parsed.occurredAt).toBeUndefined();
    expect(parsed.endpoint).toBeUndefined();
  });

  it("normalizes blank heartbeat fields", () => {
    const parsed = heartbeatPayloadSchema.parse({
      endpoint: "",
      platform: " ios-native ",
    });

    expect(parsed.endpoint).toBeUndefined();
    expect(parsed.platform).toBe("ios-native");
  });

  it("normalizes token payload strings", () => {
    const parsed = mobileEnrollmentTokenPayloadSchema.parse({
      version: 1,
      companyId: " company-1 ",
      siteId: " site-1 ",
      endpoint: "https://push.example.test/sub/1",
      deviceId: " sub-1 ",
      runtime: " ios-native ",
      tokenVersion: 2,
      nonce: " nonce-1 ",
      visitorName: " Ari Contractor ",
      visitorPhone: " +64211234567 ",
      visitorEmail: "ARI@example.test",
      employerName: " Acme ",
      visitorType: "EMPLOYEE",
      issuedAt: 1,
      expiresAt: 2,
    });

    expect(parsed.companyId).toBe("company-1");
    expect(parsed.runtime).toBe("ios-native");
    expect(parsed.visitorEmail).toBe("ari@example.test");
    expect(parsed.employerName).toBe("Acme");
  });
});
