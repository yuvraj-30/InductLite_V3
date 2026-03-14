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

  it("rejects pre-v3 token hashes", () => {
    const apiKey = "partner_legacy_key";
    const legacyHash =
      "2b93b4c3744f4acaf83d6766afaa52493c398bb9d0f5f5f1f1503c7f621c0a9d";
    const v2Hash =
      "v2:58b43b2df36747de450773eb6e77c7a58c83c25ad96f676fc27ea4b2264e6ff5";

    expect(verifyPartnerApiKey(apiKey, legacyHash)).toBe(false);
    expect(verifyPartnerApiKey(apiKey, v2Hash)).toBe(false);
    expect(verifyDirectorySyncApiKey(apiKey, legacyHash)).toBe(false);
    expect(verifyDirectorySyncApiKey(apiKey, v2Hash)).toBe(false);
  });

  it("creates deterministic keyed fingerprints for audit-safe token correlation", () => {
    const fingerprint = fingerprintApiKey("partner_example_key");

    expect(fingerprint).toHaveLength(16);
    expect(fingerprint).toBe(fingerprintApiKey("partner_example_key"));
    expect(fingerprint).not.toBe(fingerprintApiKey("partner_other_key"));
  });
});
