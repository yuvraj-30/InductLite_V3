/**
 * CSRF Origin Validation Extended Tests
 *
 * Tests for validateOrigin and assertOrigin with allowed/denied origins.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock next/headers before importing module
const mockHeaders = vi.fn();
vi.mock("next/headers", () => ({
  headers: () => mockHeaders(),
}));

// Import after mocking
import { validateOrigin, assertOrigin } from "../auth/csrf";

describe("CSRF Origin Validation", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe("validateOrigin", () => {
    it("should accept request from allowed origin", async () => {
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === "origin") return "https://app.example.com";
          return null;
        },
      });

      const result = await validateOrigin();
      expect(result).toBe(true);
    });

    it("should reject request from disallowed origin", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === "origin") return "https://evil.com";
          return null;
        },
      });

      const result = await validateOrigin();
      expect(result).toBe(false);
    });

    it("should accept localhost in development", async () => {
      vi.stubEnv("NODE_ENV", "development");
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === "origin") return "http://localhost:3000";
          return null;
        },
      });

      const result = await validateOrigin();
      expect(result).toBe(true);
    });

    it("should accept 127.0.0.1 in development", async () => {
      vi.stubEnv("NODE_ENV", "development");
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === "origin") return "http://127.0.0.1:3000";
          return null;
        },
      });

      const result = await validateOrigin();
      expect(result).toBe(true);
    });

    it("should fall back to referer if origin is missing", async () => {
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === "origin") return null;
          if (name === "referer") return "https://app.example.com/admin/sites";
          return null;
        },
      });

      const result = await validateOrigin();
      expect(result).toBe(true);
    });

    it("should reject invalid referer", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === "origin") return null;
          if (name === "referer") return "https://evil.com/phishing";
          return null;
        },
      });

      const result = await validateOrigin();
      expect(result).toBe(false);
    });

    it("should reject malformed referer URL", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === "origin") return null;
          if (name === "referer") return "not-a-valid-url";
          return null;
        },
      });

      const result = await validateOrigin();
      expect(result).toBe(false);
    });

    it("should allow requests without origin/referer in development", async () => {
      vi.stubEnv("NODE_ENV", "development");
      mockHeaders.mockResolvedValue({
        get: () => null,
      });

      const result = await validateOrigin();
      expect(result).toBe(true);
    });

    it("should reject requests without origin/referer in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockHeaders.mockResolvedValue({
        get: () => null,
      });

      const result = await validateOrigin();
      expect(result).toBe(false);
    });
  });

  describe("assertOrigin", () => {
    it("should not throw for valid origin", async () => {
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === "origin") return "https://app.example.com";
          return null;
        },
      });

      await expect(assertOrigin()).resolves.toBeUndefined();
    });

    it("should throw for invalid origin", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === "origin") return "https://evil.com";
          return null;
        },
      });

      await expect(assertOrigin()).rejects.toThrow("Invalid request origin");
    });

    it("should throw for missing headers in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockHeaders.mockResolvedValue({
        get: () => null,
      });

      await expect(assertOrigin()).rejects.toThrow("Invalid request origin");
    });
  });

  describe("origin with different ports", () => {
    it("should reject origin with different port", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === "origin") return "https://app.example.com:8080";
          return null;
        },
      });

      const result = await validateOrigin();
      expect(result).toBe(false);
    });
  });

  describe("origin with subdomains", () => {
    it("should reject subdomain of allowed origin", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === "origin") return "https://evil.app.example.com";
          return null;
        },
      });

      const result = await validateOrigin();
      expect(result).toBe(false);
    });
  });
});
