/**
 * Zod Schema Validation Tests
 *
 * Tests for public sign-in and history filter schemas.
 * These tests import the ACTUAL schemas from the shared validation module,
 * ensuring tests fail if the production schemas are broken.
 */

import { describe, it, expect } from "vitest";
import {
  signInSchema,
  signOutSchema,
  historyFiltersSchema,
  visitorTypeSchema,
  MAX_PAGE_SIZE,
  MAX_STRING_LENGTH,
} from "@/lib/validation/schemas";

// ============================================================================
// PUBLIC SIGN-IN SCHEMA TESTS
// ============================================================================

describe("Public Sign-In Schema Validation", () => {
  describe("signInSchema", () => {
    const validInput = {
      slug: "abc123",
      visitorName: "John Doe",
      visitorPhone: "+64412345678",
      visitorType: "CONTRACTOR" as const,
      answers: [{ questionId: "clxxxxxxxxxxxxxxxxxxxxxxxxx", answer: "yes" }],
    };

    it("should accept valid sign-in data", () => {
      const result = signInSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject empty slug", () => {
      const result = signInSchema.safeParse({ ...validInput, slug: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Site slug is required");
      }
    });

    it("should reject name shorter than 2 characters", () => {
      const result = signInSchema.safeParse({
        ...validInput,
        visitorName: "J",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "Name must be at least 2 characters",
        );
      }
    });

    it("should reject name longer than 100 characters", () => {
      const result = signInSchema.safeParse({
        ...validInput,
        visitorName: "a".repeat(101),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Name is too long");
      }
    });

    it("should reject phone shorter than 6 characters", () => {
      const result = signInSchema.safeParse({
        ...validInput,
        visitorPhone: "12345",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "Phone number is too short",
        );
      }
    });

    it("should reject phone longer than 20 characters", () => {
      const result = signInSchema.safeParse({
        ...validInput,
        visitorPhone: "1".repeat(21),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "Phone number is too long",
        );
      }
    });

    it("should reject phone with invalid characters", () => {
      const result = signInSchema.safeParse({
        ...validInput,
        visitorPhone: "0412abc678",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "Invalid phone number format",
        );
      }
    });

    it("should accept phone with spaces, dashes, and parentheses", () => {
      const result = signInSchema.safeParse({
        ...validInput,
        visitorPhone: "+64 (4) 123-4567",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const result = signInSchema.safeParse({
        ...validInput,
        visitorEmail: "not-an-email",
      });
      expect(result.success).toBe(false);
    });

    it("should accept empty string for optional email", () => {
      const result = signInSchema.safeParse({
        ...validInput,
        visitorEmail: "",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid visitor type", () => {
      const result = signInSchema.safeParse({
        ...validInput,
        visitorType: "INVALID_TYPE",
      });
      expect(result.success).toBe(false);
    });

    it("should accept all valid visitor types", () => {
      const types = ["CONTRACTOR", "VISITOR", "EMPLOYEE", "DELIVERY"] as const;
      for (const type of types) {
        const result = signInSchema.safeParse({
          ...validInput,
          visitorType: type,
        });
        expect(result.success).toBe(true);
      }
    });

    it("should reject answers with invalid CUID", () => {
      const result = signInSchema.safeParse({
        ...validInput,
        answers: [{ questionId: "not-a-cuid", answer: "yes" }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("signOutSchema", () => {
    it("should accept valid sign-out data", () => {
      const result = signOutSchema.safeParse({
        token: "valid-token-string",
        phone: "+64211234567",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty token", () => {
      const result = signOutSchema.safeParse({
        token: "",
        phone: "+64211234567",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "Sign-out token is required",
        );
      }
    });

    it("should reject phone shorter than 6 characters", () => {
      const result = signOutSchema.safeParse({
        token: "valid-token",
        phone: "12345",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("visitorTypeSchema", () => {
    it("should accept all valid visitor types", () => {
      const validTypes = ["CONTRACTOR", "VISITOR", "EMPLOYEE", "DELIVERY"];
      for (const type of validTypes) {
        const result = visitorTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid visitor types", () => {
      const invalidTypes = ["ADMIN", "GUEST", "OTHER", "", null, undefined];
      for (const type of invalidTypes) {
        const result = visitorTypeSchema.safeParse(type);
        expect(result.success).toBe(false);
      }
    });
  });
});

// ============================================================================
// HISTORY FILTERS SCHEMA TESTS
// ============================================================================

describe("History Filters Schema Validation", () => {
  describe("bounds and limits", () => {
    it("should accept valid filter with defaults", () => {
      const result = historyFiltersSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(20);
      }
    });

    it("should enforce MAX_PAGE_SIZE constant", () => {
      expect(MAX_PAGE_SIZE).toBe(100);
      const result = historyFiltersSchema.safeParse({
        pageSize: MAX_PAGE_SIZE + 1,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain(
          "Page size cannot exceed 100",
        );
      }
    });

    it("should accept pageSize at boundary", () => {
      const result = historyFiltersSchema.safeParse({
        pageSize: MAX_PAGE_SIZE,
      });
      expect(result.success).toBe(true);
    });

    it("should reject non-positive page numbers", () => {
      const result = historyFiltersSchema.safeParse({ page: 0 });
      expect(result.success).toBe(false);
    });

    it("should reject negative page numbers", () => {
      const result = historyFiltersSchema.safeParse({ page: -1 });
      expect(result.success).toBe(false);
    });

    it("should reject non-integer page numbers", () => {
      const result = historyFiltersSchema.safeParse({ page: 1.5 });
      expect(result.success).toBe(false);
    });
  });

  describe("string length limits", () => {
    it("should enforce MAX_STRING_LENGTH constant", () => {
      expect(MAX_STRING_LENGTH).toBe(200);
    });

    it("should reject employerName longer than MAX_STRING_LENGTH", () => {
      const result = historyFiltersSchema.safeParse({
        employerName: "a".repeat(MAX_STRING_LENGTH + 1),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Employer name too long");
      }
    });

    it("should reject search longer than MAX_STRING_LENGTH", () => {
      const result = historyFiltersSchema.safeParse({
        search: "a".repeat(MAX_STRING_LENGTH + 1),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Search term too long");
      }
    });

    it("should accept strings at boundary", () => {
      const result = historyFiltersSchema.safeParse({
        employerName: "a".repeat(MAX_STRING_LENGTH),
        search: "b".repeat(MAX_STRING_LENGTH),
      });
      expect(result.success).toBe(true);
    });
  });

  describe("enum validation", () => {
    it("should accept all valid visitor types", () => {
      const types = ["CONTRACTOR", "VISITOR", "EMPLOYEE", "DELIVERY"] as const;
      for (const type of types) {
        const result = historyFiltersSchema.safeParse({ visitorType: type });
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid visitor type", () => {
      const result = historyFiltersSchema.safeParse({
        visitorType: "INVALID",
      });
      expect(result.success).toBe(false);
    });

    it("should accept all valid status values", () => {
      const statuses = ["on_site", "signed_out", "all"] as const;
      for (const status of statuses) {
        const result = historyFiltersSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid status", () => {
      const result = historyFiltersSchema.safeParse({ status: "pending" });
      expect(result.success).toBe(false);
    });
  });

  describe("date parsing guards", () => {
    it("should accept valid ISO date string for dateFrom", () => {
      const result = historyFiltersSchema.safeParse({
        dateFrom: "2025-01-26",
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid ISO datetime for dateTo", () => {
      const result = historyFiltersSchema.safeParse({
        dateTo: "2025-01-26T23:59:59Z",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid date format for dateFrom", () => {
      const result = historyFiltersSchema.safeParse({
        dateFrom: "not-a-date",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Invalid date format");
      }
    });

    it("should reject invalid date format for dateTo", () => {
      const result = historyFiltersSchema.safeParse({
        dateTo: "32/13/2025",
      });
      expect(result.success).toBe(false);
    });

    it("should accept empty string for optional dates", () => {
      const result = historyFiltersSchema.safeParse({
        dateFrom: "",
        dateTo: "",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("CUID validation for siteId", () => {
    it("should accept valid CUID for siteId", () => {
      const result = historyFiltersSchema.safeParse({
        siteId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid CUID for siteId", () => {
      const result = historyFiltersSchema.safeParse({
        siteId: "not-a-cuid",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Invalid site ID");
      }
    });
  });
});
