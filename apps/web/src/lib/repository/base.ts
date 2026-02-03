/**
 * Repository Layer
 *
 * TENANT ISOLATION STRATEGY:
 * Every repository method requires an explicit company_id parameter.
 * There are no methods that query across all companies.
 * This ensures tenant data isolation at the application layer.
 *
 * The repository layer provides:
 * - Type-safe database operations
 * - Mandatory tenant scoping
 * - Consistent error handling
 * - Audit log integration
 */

import { Prisma } from "@prisma/client";

/**
 * Repository error types for consistent error handling
 */
export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: RepositoryErrorCode,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

export type RepositoryErrorCode =
  | "NOT_FOUND" // Resource doesn't exist
  | "ALREADY_EXISTS" // Unique constraint violation
  | "DUPLICATE" // Duplicate entry (business logic)
  | "FORBIDDEN" // Access denied (wrong company)
  | "INVALID_INPUT" // Validation error
  | "VALIDATION" // Business rule validation failure
  | "FOREIGN_KEY" // Referenced entity doesn't exist
  | "DATABASE_ERROR"; // Generic database error

/**
 * Convert Prisma errors to repository errors
 */
export function handlePrismaError(error: unknown, entityName: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": // Unique constraint violation
        throw new RepositoryError(
          `${entityName} already exists`,
          "ALREADY_EXISTS",
          error,
        );

      case "P2025": // Record not found
        throw new RepositoryError(
          `${entityName} not found`,
          "NOT_FOUND",
          error,
        );

      case "P2003": // Foreign key constraint failed
        throw new RepositoryError(
          `Referenced entity not found`,
          "FOREIGN_KEY",
          error,
        );

      default:
        throw new RepositoryError(
          `Database error: ${error.message}`,
          "DATABASE_ERROR",
          error,
        );
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    throw new RepositoryError("Invalid input data", "INVALID_INPUT", error);
  }

  if (error instanceof RepositoryError) {
    throw error;
  }

  throw new RepositoryError(
    `Unknown error: ${error instanceof Error ? error.message : String(error)}`,
    "DATABASE_ERROR",
    error instanceof Error ? error : undefined,
  );
}

/**
 * Ensure company_id is provided
 * This is a runtime check to catch any missing company_id
 */
export function requireCompanyId(companyId: unknown): string {
  if (typeof companyId !== "string" || companyId.length === 0) {
    throw new RepositoryError(
      "company_id is required for all repository operations",
      "FORBIDDEN",
    );
  }
  return companyId;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Default pagination values
 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Normalize pagination parameters
 */
export function normalizePagination(params: PaginationParams): {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE),
  );

  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
    page,
    pageSize,
  };
}

/**
 * Create paginated result
 */
export function paginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Sort direction
 */
export type SortDirection = "asc" | "desc";

/**
 * Sort parameters
 */
export interface SortParams<TField extends string = string> {
  field: TField;
  direction: SortDirection;
}

/**
 * Common filter operators
 */
export interface FilterOperators<T> {
  equals?: T;
  not?: T;
  in?: T[];
  notIn?: T[];
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  gt?: T;
  gte?: T;
  lt?: T;
  lte?: T;
}

/**
 * Date range filter
 */
export interface DateRangeFilter {
  from?: Date;
  to?: Date;
}

/**
 * Build date range filter for Prisma
 */
export function buildDateRangeFilter(
  range: DateRangeFilter | undefined,
): object | undefined {
  if (!range || (!range.from && !range.to)) {
    return undefined;
  }

  const filter: { gte?: Date; lte?: Date } = {};

  if (range.from) {
    filter.gte = range.from;
  }

  if (range.to) {
    filter.lte = range.to;
  }

  return filter;
}
