import { createHash, createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  fingerprintApiKey,
  hashDirectorySyncApiKey,
  hashPartnerApiKey,
  verifyDirectorySyncApiKey,
  verifyPartnerApiKey,
} from "./config";

describe("identity API key hashing", () => {
  const originalDataEncryptionKey = process.env.DATA_ENCRYPTION_KEY;
  const originalSessionSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.DATA_ENCRYPTION_KEY =
      "test-data-encryption-key-32-characters-min";
    process.env.SESSION_SECRET = "test-session-secret-32-characters-min";
  });

  afterEach(() => {
    process.env.DATA_ENCRYPTION_KEY = originalDataEncryptionKey;
    process.env.SESSION_SECRET = originalSessionSecret;
  });

  it("hashes directory sync keys with a versioned keyed digest", () => {
    const apiKey = "idsync_example_key";
    const storedHash = hashDirectorySyncApiKey(apiKey);

    expect(storedHash.startsWith("v3:")).toBe(true);
    expect(verifyDirectorySyncApiKey(apiKey, storedHash)).toBe(true);
    expect(verifyDirectorySyncApiKey("idsync_other_key", storedHash)).toBe(
      false,
    );
  });

  it("hashes partner API keys with a versioned keyed digest", () => {
    const apiKey = "partner_example_key";
    const storedHash = hashPartnerApiKey(apiKey);

    expect(storedHash.startsWith("v3:")).toBe(true);
    expect(verifyPartnerApiKey(apiKey, storedHash)).toBe(true);
    expect(verifyPartnerApiKey("partner_other_key", storedHash)).toBe(false);
  });

  it("continues to verify v2 keyed token hashes", () => {
    const apiKey = "partner_v2_key";
    const v2Hash = `v2:${createHmac("sha256", process.env.DATA_ENCRYPTION_KEY!)
      .update(apiKey)
      .digest("hex")}`;

    expect(verifyPartnerApiKey(apiKey, v2Hash)).toBe(true);
    expect(verifyDirectorySyncApiKey(apiKey, v2Hash)).toBe(true);
  });

  it("continues to verify legacy sha256 token hashes", () => {
    const partnerApiKey = "partner_legacy_key";
    const directoryApiKey = "idsync_legacy_key";
    const partnerLegacyHash = createHash("sha256")
      .update(partnerApiKey)
      .digest("hex");
    const directoryLegacyHash = createHash("sha256")
      .update(directoryApiKey)
      .digest("hex");

    expect(verifyPartnerApiKey(partnerApiKey, partnerLegacyHash)).toBe(true);
    expect(verifyDirectorySyncApiKey(directoryApiKey, directoryLegacyHash)).toBe(
      true,
    );
  });

  it("creates deterministic keyed fingerprints for audit-safe token correlation", () => {
    const fingerprint = fingerprintApiKey("partner_example_key");

    expect(fingerprint).toHaveLength(16);
    expect(fingerprint).toBe(fingerprintApiKey("partner_example_key"));
    expect(fingerprint).not.toBe(fingerprintApiKey("partner_other_key"));
  });
});
