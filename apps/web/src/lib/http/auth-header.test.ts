import { describe, expect, it } from "vitest";
import { parseBearerToken } from "./auth-header";

describe("parseBearerToken", () => {
  it("extracts bearer tokens", () => {
    expect(parseBearerToken("Bearer abc123")).toBe("abc123");
    expect(parseBearerToken("bearer abc123")).toBe("abc123");
  });

  it("rejects missing or invalid authorization headers", () => {
    expect(parseBearerToken("Token abc123")).toBeNull();
    expect(parseBearerToken("Bearer   ")).toBeNull();
    expect(parseBearerToken(null)).toBeNull();
  });
});
