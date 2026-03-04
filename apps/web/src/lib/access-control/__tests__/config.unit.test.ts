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
    });

    expect(config.geofence.mode).toBe("OVERRIDE");
    expect(config.geofence.allowMissingLocation).toBe(false);
    expect(config.geofence.overrideCodeHash).toBe("a".repeat(64));
    expect(config.hardware.enabled).toBe(true);
    expect(config.hardware.provider).toBe("GATEWAY_X");
    expect(config.hardware.endpointUrl).toBe(
      "https://hardware.example.test/access",
    );
    expect(hasHardwareAccessTarget(config)).toBe(true);
  });

  it("builds override hash and verifies a supplied code", () => {
    const config = buildAccessControlConfig({
      geofenceMode: "OVERRIDE",
      geofenceAllowMissingLocation: true,
      geofenceOverrideCode: "123456",
      hardwareEnabled: false,
      hardwareEndpointUrl: null,
      existingConfig: parseAccessControlConfig(null),
    });

    expect(config.geofence.overrideCodeHash).toBeTruthy();
    expect(
      verifyGeofenceOverrideCode(config.geofence.overrideCodeHash, "123456"),
    ).toBe(true);
    expect(
      verifyGeofenceOverrideCode(config.geofence.overrideCodeHash, "bad-code"),
    ).toBe(false);
  });

  it("disables hardware target when URL is invalid", () => {
    const config = buildAccessControlConfig({
      geofenceMode: "AUDIT",
      geofenceAllowMissingLocation: true,
      hardwareEnabled: true,
      hardwareEndpointUrl: "not-a-url",
      existingConfig: parseAccessControlConfig(null),
    });

    expect(config.hardware.enabled).toBe(false);
    expect(config.hardware.endpointUrl).toBeNull();
    expect(hasHardwareAccessTarget(config)).toBe(false);
  });
});
