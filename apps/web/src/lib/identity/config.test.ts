import { describe, expect, it } from "vitest";
import {
  hashDirectorySyncApiKey,
  hashPartnerApiKey,
  verifyDirectorySyncApiKey,
  verifyPartnerApiKey,
} from "./config";

describe("identity api key hashing", () => {
  it("hashes new api keys with the scrypt prefix and verifies them", () => {
    const apiKey = "idsync_example_token";
    const hash = hashDirectorySyncApiKey(apiKey);

    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(verifyDirectorySyncApiKey(apiKey, hash)).toBe(true);
    expect(verifyDirectorySyncApiKey("wrong-token", hash)).toBe(false);
  });

  it("rejects legacy sha256 partner hashes so rotated keys are required", () => {
    const legacyHash =
      "8eb3ae7220ddb64b8b406eafe8bb46f6e428853210ce55ae82f27eb5ef43c901";

    expect(verifyPartnerApiKey("partner_legacy_token", legacyHash)).toBe(false);
    expect(verifyPartnerApiKey("partner_wrong_token", legacyHash)).toBe(false);
  });

  it("creates distinct hashes for the same partner key because of random salts", () => {
    const apiKey = "partner_example_token";
    const first = hashPartnerApiKey(apiKey);
    const second = hashPartnerApiKey(apiKey);

    expect(first).not.toBe(second);
    expect(verifyPartnerApiKey(apiKey, first)).toBe(true);
    expect(verifyPartnerApiKey(apiKey, second)).toBe(true);
  });
});
