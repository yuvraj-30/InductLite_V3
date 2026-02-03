/**
 * Consistent API Response Types
 *
 * Provides typed response shapes for all API actions.
 * Ensures consistent error handling across the application.
 */

import type { RepositoryErrorCode } from "@/lib/repository";

/**
 * API Error codes - includes repository codes plus API-specific ones
 */
export type ApiErrorCode =
  | RepositoryErrorCode
  | "UNAUTHORIZED" // Not authenticated
  | "PERMISSION_DENIED" // Not authorized for this action
  | "VALIDATION_ERROR" // Input validation failed
  | "RATE_LIMITED" // Too many requests
  | "NO_TEMPLATE" // No active induction template for site
  | "INTERNAL_ERROR"; // Unexpected server error

/**
 * Field-level validation errors
 */
export type FieldErrors = Record<string, string[]>;

/**
 * Typed API error
 */
export interface ApiError {
  code: ApiErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
}

/**
 * Success response
 */
export interface ApiSuccessResponse<T = void> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Error response
 */
export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T = void> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Helper to create a success response
 */
export function successResponse<T>(
  data: T,
  message?: string,
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}

/**
 * Helper to create an error response
 */
export function errorResponse(
  code: ApiErrorCode,
  message: string,
  fieldErrors?: FieldErrors,
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      fieldErrors,
    },
  };
}

/**
 * Type guard to check if response is successful
 */
export function isSuccess<T>(
  response: ApiResponse<T>,
): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard to check if response is an error
 */
export function isError<T>(
  response: ApiResponse<T>,
): response is ApiErrorResponse {
  return response.success === false;
}

/**
 * Map repository error codes to API error codes
 */
export function mapRepositoryError(code: RepositoryErrorCode): ApiErrorCode {
  return code; // They're compatible
}

/**
 * Create validation error response from Zod errors
 */
export function validationErrorResponse(
  fieldErrors: FieldErrors,
  message = "Validation failed",
): ApiErrorResponse {
  return errorResponse("VALIDATION_ERROR", message, fieldErrors);
}

/**
 * Create unauthorized error response
 */
export function unauthorizedResponse(
  message = "Authentication required",
): ApiErrorResponse {
  return errorResponse("UNAUTHORIZED", message);
}

/**
 * Create permission denied error response
 */
export function permissionDeniedResponse(
  message = "You do not have permission to perform this action",
): ApiErrorResponse {
  return errorResponse("PERMISSION_DENIED", message);
}

/**
 * Create rate limited error response
 */
export function rateLimitedResponse(
  retryAfterSeconds?: number,
): ApiErrorResponse {
  const message = retryAfterSeconds
    ? `Too many requests. Please try again in ${retryAfterSeconds} seconds.`
    : "Too many requests. Please try again later.";
  return errorResponse("RATE_LIMITED", message);
}
