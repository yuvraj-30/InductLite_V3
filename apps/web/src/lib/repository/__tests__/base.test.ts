/**
 * Repository Base Utilities Tests
 */

import { describe, it, expect } from "vitest";
import {
  requireCompanyId,
  normalizePagination,
  paginatedResult,
  buildDateRangeFilter,
  RepositoryError,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "../base";

describe("Repository Base Utilities", () => {
  describe("requireCompanyId", () => {
    it("should return the company ID for valid input", () => {
      const result = requireCompanyId("company-123");

      expect(result).toBe("company-123");
    });

    it("should throw for empty string", () => {
      expect(() => requireCompanyId("")).toThrow(RepositoryError);
    });

    it("should throw for null", () => {
      expect(() => requireCompanyId(null)).toThrow(RepositoryError);
    });

    it("should throw for undefined", () => {
      expect(() => requireCompanyId(undefined)).toThrow(RepositoryError);
    });

    it("should throw for non-string", () => {
      expect(() => requireCompanyId(123)).toThrow(RepositoryError);
    });
  });

  describe("normalizePagination", () => {
    it("should use defaults for empty params", () => {
      const result = normalizePagination({});

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
      expect(result.skip).toBe(0);
      expect(result.take).toBe(DEFAULT_PAGE_SIZE);
    });

    it("should calculate skip correctly", () => {
      const result = normalizePagination({ page: 3, pageSize: 10 });

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
      expect(result.skip).toBe(20);
      expect(result.take).toBe(10);
    });

    it("should clamp page to minimum 1", () => {
      const result = normalizePagination({ page: 0 });

      expect(result.page).toBe(1);
    });

    it("should clamp page to minimum 1 for negative", () => {
      const result = normalizePagination({ page: -5 });

      expect(result.page).toBe(1);
    });

    it("should clamp pageSize to MAX_PAGE_SIZE", () => {
      const result = normalizePagination({ pageSize: 500 });

      expect(result.pageSize).toBe(MAX_PAGE_SIZE);
    });

    it("should clamp pageSize to minimum 1", () => {
      const result = normalizePagination({ pageSize: 0 });

      expect(result.pageSize).toBe(1);
    });
  });

  describe("paginatedResult", () => {
    it("should create correct result structure", () => {
      const items = [{ id: 1 }, { id: 2 }];
      const result = paginatedResult(items, 50, 1, 10);

      expect(result.items).toBe(items);
      expect(result.total).toBe(50);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(5);
    });

    it("should calculate totalPages correctly with remainder", () => {
      const result = paginatedResult([], 55, 1, 10);

      expect(result.totalPages).toBe(6);
    });

    it("should handle zero total", () => {
      const result = paginatedResult([], 0, 1, 10);

      expect(result.totalPages).toBe(0);
    });
  });

  describe("buildDateRangeFilter", () => {
    it("should return undefined for undefined range", () => {
      const result = buildDateRangeFilter(undefined);

      expect(result).toBeUndefined();
    });

    it("should return undefined for empty range", () => {
      const result = buildDateRangeFilter({});

      expect(result).toBeUndefined();
    });

    it("should build filter with from only", () => {
      const from = new Date("2024-01-01");
      const result = buildDateRangeFilter({ from });

      expect(result).toEqual({ gte: from });
    });

    it("should build filter with to only", () => {
      const to = new Date("2024-12-31");
      const result = buildDateRangeFilter({ to });

      expect(result).toEqual({ lte: to });
    });

    it("should build filter with both from and to", () => {
      const from = new Date("2024-01-01");
      const to = new Date("2024-12-31");
      const result = buildDateRangeFilter({ from, to });

      expect(result).toEqual({ gte: from, lte: to });
    });
  });

  describe("RepositoryError", () => {
    it("should create error with message and code", () => {
      const error = new RepositoryError("Not found", "NOT_FOUND");

      expect(error.message).toBe("Not found");
      expect(error.code).toBe("NOT_FOUND");
      expect(error.name).toBe("RepositoryError");
    });

    it("should include cause when provided", () => {
      const cause = new Error("Original error");
      const error = new RepositoryError(
        "Wrapped error",
        "DATABASE_ERROR",
        cause,
      );

      expect(error.cause).toBe(cause);
    });
  });
});
