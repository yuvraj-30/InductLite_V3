import { describe, expect, it } from "vitest";
import {
  buildAccessControlConfig,
  hasHardwareAccessTarget,
  parseAccessControlConfig,
  verifyGeofenceOverrideCode,
} from "../config";

describe("access control config", () => {
  it("parses geofence and hardware settings", () => {
    const config = parseAccessControlConfig({
      geofence: {
        mode: "override",
        allowMissingLocation: false,
        overrideCodeHash: "a".repeat(64),
      },
      hardware: {
        enabled: true,
        provider: "GATEWAY_X",
        endpointUrl: "https://hardware.example.test/access",
        authToken: "token-123",
      },
      identity: {
        enabled: true,
        requirePhoto: true,
        requireIdScan: true,
        requireConsent: true,
      },
    });

    expect(config.geofence.mode).toBe("OVERRIDE");
    expect(config.geofence.allowMissingLocation).toBe(false);
    expect(config.geofence.overrideCodeHash).toBe("a".repeat(64));
    expect(config.geofence.automationMode).toBe("OFF");
    expect(config.geofence.autoCheckoutGraceMinutes).toBe(30);
    expect(config.hardware.enabled).toBe(true);
    expect(config.hardware.provider).toBe("GATEWAY_X");
    expect(config.hardware.endpointUrl).toBe(
      "https://hardware.example.test/access",
    );
    expect(config.identity.enabled).toBe(true);
    expect(config.identity.requirePhoto).toBe(true);
    expect(config.identity.requireIdScan).toBe(true);
    expect(config.identity.requireConsent).toBe(true);
    expect(config.identity.requireOcrVerification).toBe(false);
    expect(config.identity.allowedDocumentTypes).toEqual([
      "DRIVER_LICENCE",
      "PASSPORT",
    ]);
    expect(config.identity.ocrDecisionMode).toBe("assist");
    expect(hasHardwareAccessTarget(config)).toBe(true);
  });

  it("builds override hash and verifies a supplied code", () => {
    const config = buildAccessControlConfig({
      geofenceMode: "OVERRIDE",
      geofenceAllowMissingLocation: true,
      geofenceOverrideCode: "123456",
      geofenceAutomationMode: "ASSIST",
      geofenceAutoCheckoutGraceMinutes: 45,
      hardwareEnabled: false,
      hardwareEndpointUrl: null,
      identityEnabled: true,
      identityRequirePhoto: true,
      identityRequireIdScan: false,
      identityRequireConsent: true,
      identityRequireOcrVerification: true,
      identityAllowedDocumentTypes: ["passport", "driver licence"],
      identityOcrDecisionMode: "strict",
      existingConfig: parseAccessControlConfig(null),
    });

    expect(config.geofence.overrideCodeHash).toBeTruthy();
    expect(
      verifyGeofenceOverrideCode(config.geofence.overrideCodeHash, "123456"),
    ).toBe(true);
    expect(
      verifyGeofenceOverrideCode(config.geofence.overrideCodeHash, "bad-code"),
    ).toBe(false);
    expect(config.geofence.automationMode).toBe("ASSIST");
    expect(config.geofence.autoCheckoutGraceMinutes).toBe(45);
    expect(config.identity.enabled).toBe(true);
    expect(config.identity.requirePhoto).toBe(true);
    expect(config.identity.requireIdScan).toBe(false);
    expect(config.identity.requireConsent).toBe(true);
    expect(config.identity.requireOcrVerification).toBe(false);
    expect(config.identity.allowedDocumentTypes).toEqual([
      "PASSPORT",
      "DRIVER_LICENCE",
    ]);
    expect(config.identity.ocrDecisionMode).toBe("strict");
  });

  it("disables hardware target when URL is invalid", () => {
    const config = buildAccessControlConfig({
      geofenceMode: "AUDIT",
      geofenceAllowMissingLocation: true,
      geofenceAutomationMode: "OFF",
      geofenceAutoCheckoutGraceMinutes: 30,
      hardwareEnabled: true,
      hardwareEndpointUrl: "not-a-url",
      identityEnabled: false,
      identityRequireOcrVerification: false,
      existingConfig: parseAccessControlConfig(null),
    });

    expect(config.hardware.enabled).toBe(false);
    expect(config.hardware.endpointUrl).toBeNull();
    expect(hasHardwareAccessTarget(config)).toBe(false);
  });
});
