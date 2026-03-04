import { describe, expect, it } from "vitest";
import {
  buildWebhookConfigFromUrls,
  parseWebhookConfig,
  resolveWebhookTargetsForEvent,
  rotateWebhookSigningSecret,
} from "../config";

describe("webhook config helpers", () => {
  it("parses legacy array payloads into normalized config", () => {
    const config = parseWebhookConfig([
      "https://example.com/a",
      "invalid-url",
      { url: "https://example.com/b", enabled: false },
      "https://example.com/a",
    ]);

    expect(config.endpoints).toHaveLength(2);
    expect(config.endpoints.find((entry) => entry.url.includes("/a"))).toMatchObject(
      {
        enabled: true,
      },
    );
    expect(config.endpoints.find((entry) => entry.url.includes("/b"))).toMatchObject(
      {
        enabled: false,
      },
    );
  });

  it("resolves only enabled endpoints subscribed to event", () => {
    const targets = resolveWebhookTargetsForEvent(
      {
        endpoints: [
          {
            id: "1",
            url: "https://example.com/a",
            enabled: true,
            events: ["induction.completed"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "2",
            url: "https://example.com/b",
            enabled: false,
            events: ["induction.completed"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      "induction.completed",
    );

    expect(targets).toEqual(["https://example.com/a"]);
  });

  it("builds config from URL list preserving endpoint identity", () => {
    const existing = parseWebhookConfig({
      endpoints: [
        {
          id: "stable-id",
          url: "https://example.com/a",
          enabled: true,
          events: ["induction.completed"],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      signingSecret: "1234567890abcdef",
      signingSecretUpdatedAt: "2026-01-01T00:00:00.000Z",
    });

    const config = buildWebhookConfigFromUrls({
      urls: ["https://example.com/a", "https://example.com/c"],
      existingConfig: existing,
      signingSecret: "1234567890abcdef",
    });

    expect(config.endpoints).toHaveLength(2);
    expect(config.endpoints.find((entry) => entry.url.includes("/a"))?.id).toBe(
      "stable-id",
    );
    expect(config.signingSecret).toBe("1234567890abcdef");
  });

  it("generates a rotation secret with sufficient entropy length", () => {
    const secret = rotateWebhookSigningSecret();
    expect(secret.length).toBeGreaterThanOrEqual(32);
  });
});
