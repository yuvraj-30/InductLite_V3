/**
 * Public Sign-In/Sign-Out Actions Tests
 *
 * Tests error handling to ensure:
 * 1. Raw error messages are never leaked to public responses
 * 2. Logging includes requestId and slug but never PII
 * 3. Generic error messages are returned for all error types
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Mock all dependencies before importing the module under test
vi.mock("@/lib/repository/site.repository", () => ({
  findSiteByPublicSlug: vi.fn(),
}));

vi.mock("@/lib/repository/template.repository", () => ({
  getActiveTemplateForSite: vi.fn(),
}));

vi.mock("@/lib/repository/public-signin.repository", () => ({
  createPublicSignIn: vi.fn(),
  signOutWithToken: vi.fn(),
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkPublicSlugRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkSignInRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkSignOutRateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertOrigin: vi.fn().mockResolvedValue(undefined),
  generateRequestId: vi.fn().mockReturnValue("test-request-id-123"),
  getClientIp: vi.fn().mockResolvedValue("127.0.0.1"),
  getUserAgent: vi.fn().mockResolvedValue("test-agent"),
}));

// Import after mocks are set up
import { submitSignIn, submitSignOut, getSiteForSignIn } from "./actions";
import { findSiteByPublicSlug } from "@/lib/repository/site.repository";
import { getActiveTemplateForSite } from "@/lib/repository/template.repository";
import {
  createPublicSignIn,
  signOutWithToken,
} from "@/lib/repository/public-signin.repository";
import { createRequestLogger } from "@/lib/logger";

describe("Public Actions Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // safePublicErrorMessage Tests via submitSignIn
  // ============================================================================

  describe("submitSignIn error handling", () => {
    const validInput = {
      slug: "test-site",
      visitorName: "John Doe",
      visitorPhone: "+64211234567",
      visitorType: "CONTRACTOR" as const,
      answers: [],
    };

    const mockSite = {
      id: "site-123",
      name: "Test Site",
      address: "123 Test St",
      description: null,
      company: { id: "company-123", name: "Test Company" },
    };

    const mockTemplate = {
      id: "template-123",
      name: "Test Template",
      version: 1,
      questions: [],
    };

    it("should return generic error when repository throws Error with sensitive message", async () => {
      // Arrange: Mock repository to throw an error with sensitive database info
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
      (createPublicSignIn as Mock).mockRejectedValue(
        new Error(
          "FATAL: connection to server at 'db.internal.company.com' failed: Connection refused",
        ),
      );

      // Act
      const result = await submitSignIn(validInput);

      // Assert: Response should NOT contain the raw error message
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).not.toContain("db.internal.company.com");
        expect(result.error.message).not.toContain("FATAL");
        expect(result.error.message).not.toContain("Connection refused");
        expect(result.error.message).toBe(
          "An unexpected error occurred. Please try again.",
        );
      }
    });

    it("should return generic error when repository throws Error with SQL query", async () => {
      // Arrange: Simulate a Prisma error that might leak query structure
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
      (createPublicSignIn as Mock).mockRejectedValue(
        new Error(
          "Invalid `prisma.signInRecord.create()` invocation: Unique constraint failed on the fields: (`visitor_phone`)",
        ),
      );

      // Act
      const result = await submitSignIn(validInput);

      // Assert: Response should NOT contain Prisma internals
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).not.toContain("prisma");
        expect(result.error.message).not.toContain("signInRecord");
        expect(result.error.message).not.toContain("visitor_phone");
        expect(result.error.message).toBe(
          "An unexpected error occurred. Please try again.",
        );
      }
    });

    it("should return generic error when repository throws non-Error object", async () => {
      // Arrange: Some libraries throw non-Error objects
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
      (createPublicSignIn as Mock).mockRejectedValue(
        "String error with internal path /var/app/src/db.ts",
      );

      // Act
      const result = await submitSignIn(validInput);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).not.toContain("/var/app");
        expect(result.error.message).toBe(
          "An unexpected error occurred. Please try again.",
        );
      }
    });

    it("should return generic error when repository throws undefined", async () => {
      // Arrange
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
      (createPublicSignIn as Mock).mockRejectedValue(undefined);

      // Act
      const result = await submitSignIn(validInput);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe(
          "An unexpected error occurred. Please try again.",
        );
      }
    });

    it("should log error with requestId and slug but never PII", async () => {
      // Arrange
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      (createRequestLogger as Mock).mockReturnValue(mockLogger);
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockResolvedValue(mockTemplate);
      (createPublicSignIn as Mock).mockRejectedValue(
        new Error("Database error"),
      );

      // Act
      await submitSignIn(validInput);

      // Assert: Logger should be called with structured context
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      const [logContext, logMessage] = mockLogger.error.mock.calls[0] as [
        Record<string, unknown>,
        string,
      ];

      // Should include requestId and slug
      expect(logContext).toHaveProperty("requestId");
      expect(logContext).toHaveProperty("slug", "test-site");
      expect(logContext).toHaveProperty("errorType", "Error");

      // Should NOT include PII
      expect(logContext).not.toHaveProperty("visitorName");
      expect(logContext).not.toHaveProperty("visitorPhone");
      expect(logContext).not.toHaveProperty("visitorEmail");
      expect(logContext).not.toHaveProperty("phone");
      expect(logContext).not.toHaveProperty("email");
      expect(logContext).not.toHaveProperty("name");

      // Message should be generic
      expect(logMessage).toBe("Failed to create sign-in");
    });
  });

  // ============================================================================
  // submitSignOut error handling
  // ============================================================================

  describe("submitSignOut error handling", () => {
    const validSignOutInput = {
      token: "valid-token-abc123",
      phone: "+64211234567",
    };

    it("should return generic error when signOutWithToken throws", async () => {
      // Arrange
      (signOutWithToken as Mock).mockRejectedValue(
        new Error("Redis connection failed: ECONNREFUSED 127.0.0.1:6379"),
      );

      // Act
      const result = await submitSignOut(validSignOutInput);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).not.toContain("Redis");
        expect(result.error.message).not.toContain("ECONNREFUSED");
        expect(result.error.message).not.toContain("127.0.0.1");
        expect(result.error.message).toBe(
          "An unexpected error occurred. Please try again.",
        );
      }
    });

    it("should log error with requestId but never token or phone", async () => {
      // Arrange
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      (createRequestLogger as Mock).mockReturnValue(mockLogger);
      (signOutWithToken as Mock).mockRejectedValue(new Error("DB error"));

      // Act
      await submitSignOut(validSignOutInput);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      const [logContext] = mockLogger.error.mock.calls[0] as [
        Record<string, unknown>,
      ];

      // Should include requestId
      expect(logContext).toHaveProperty("requestId");
      expect(logContext).toHaveProperty("errorType", "Error");

      // Should NOT include token or phone (PII/secrets)
      expect(logContext).not.toHaveProperty("token");
      expect(logContext).not.toHaveProperty("phone");
      expect(JSON.stringify(logContext)).not.toContain("valid-token");
      expect(JSON.stringify(logContext)).not.toContain("+64211234567");
    });
  });

  // ============================================================================
  // getSiteForSignIn error handling
  // ============================================================================

  describe("getSiteForSignIn error handling", () => {
    it("should return generic error when findSiteByPublicSlug throws", async () => {
      // Arrange
      (findSiteByPublicSlug as Mock).mockRejectedValue(
        new Error(
          "PrismaClientKnownRequestError: Can't reach database server at `localhost:5432`",
        ),
      );

      // Act
      const result = await getSiteForSignIn("test-slug");

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).not.toContain("Prisma");
        expect(result.error.message).not.toContain("localhost");
        expect(result.error.message).not.toContain("5432");
        expect(result.error.message).toBe(
          "An unexpected error occurred. Please try again.",
        );
      }
    });

    it("should log error with requestId and slug", async () => {
      // Arrange
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      (createRequestLogger as Mock).mockReturnValue(mockLogger);
      (findSiteByPublicSlug as Mock).mockRejectedValue(new Error("timeout"));

      // Act
      await getSiteForSignIn("my-test-slug");

      // Assert
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      const [logContext] = mockLogger.error.mock.calls[0] as [
        Record<string, unknown>,
      ];

      expect(logContext).toHaveProperty("requestId");
      expect(logContext).toHaveProperty("slug", "my-test-slug");
      expect(logContext).toHaveProperty("errorType", "Error");
    });
  });

  // ============================================================================
  // Known safe error patterns
  // ============================================================================

  describe("safePublicErrorMessage known patterns", () => {
    it("should return rate limit message for rate limit errors", async () => {
      // Arrange
      (findSiteByPublicSlug as Mock).mockRejectedValue(
        new Error("Rate limit exceeded for IP"),
      );

      // Act
      const result = await getSiteForSignIn("test-slug");

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe(
          "Too many requests. Please try again later.",
        );
      }
    });

    it("should return not found message for not found errors", async () => {
      // Arrange
      const mockSite = {
        id: "site-123",
        name: "Test Site",
        address: null,
        description: null,
        company: { id: "company-123", name: "Test Company" },
      };
      (findSiteByPublicSlug as Mock).mockResolvedValue(mockSite);
      (getActiveTemplateForSite as Mock).mockRejectedValue(
        new Error("Template not found for site"),
      );

      // Act
      const result = await getSiteForSignIn("test-slug");

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe(
          "The requested resource was not found.",
        );
      }
    });

    it("should return session expired message for token errors", async () => {
      // Arrange
      (signOutWithToken as Mock).mockRejectedValue(
        new Error("Token expired or invalid token provided"),
      );

      // Act
      const result = await submitSignOut({ token: "abc", phone: "0400000000" });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe(
          "Your session has expired. Please try again.",
        );
      }
    });
  });
});
