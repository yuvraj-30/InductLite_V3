import { describe, expect, it } from "vitest";
import {
  buildLmsConnectorConfig,
  hasLmsConnectorTarget,
  parseLmsConnectorConfig,
} from "../config";

describe("lms connector config", () => {
  it("parses and normalizes endpoint-based configs", () => {
    const config = parseLmsConnectorConfig({
      enabled: true,
      endpointUrl: "https://lms.example.test/sync",
      provider: "Moodle",
      authToken: "token-123",
      courseCode: "SITE-INDUCT-101",
      updatedAt: "2026-03-01T12:00:00.000Z",
    });

    expect(config.enabled).toBe(true);
    expect(config.endpointUrl).toBe("https://lms.example.test/sync");
    expect(config.provider).toBe("Moodle");
    expect(config.courseCode).toBe("SITE-INDUCT-101");
    expect(hasLmsConnectorTarget(config)).toBe(true);
  });

  it("disables config when endpoint is invalid", () => {
    const config = parseLmsConnectorConfig({
      enabled: true,
      endpointUrl: "not-a-url",
    });

    expect(config.enabled).toBe(false);
    expect(config.endpointUrl).toBeNull();
    expect(hasLmsConnectorTarget(config)).toBe(false);
  });

  it("builds config with explicit disable", () => {
    const config = buildLmsConnectorConfig({
      enabled: false,
      endpointUrl: "https://lms.example.test/sync",
      authToken: "token-123",
      provider: "Moodle",
      courseCode: "COURSE-42",
      existingConfig: parseLmsConnectorConfig({
        enabled: true,
        endpointUrl: "https://lms.example.test/sync",
        updatedAt: "2026-02-01T00:00:00.000Z",
      }),
    });

    expect(config.enabled).toBe(false);
    expect(config.endpointUrl).toBe("https://lms.example.test/sync");
    expect(config.updatedAt).toBe("2026-02-01T00:00:00.000Z");
  });
});

