/**
 * Shared Zod Validation Schemas
 *
 * Single source of truth for all validation schemas used across the application.
 * Import these schemas instead of redefining them to ensure consistency.
 */

import { z } from "zod";

// ============================================================================
// CONSTANTS
// ============================================================================

export const MAX_PAGE_SIZE = 100;
export const MAX_STRING_LENGTH = 200;

// ============================================================================
// PUBLIC SIGN-IN SCHEMAS
// ============================================================================

/**
 * Visitor type enum schema
 */
export const visitorTypeSchema = z.enum([
  "CONTRACTOR",
  "VISITOR",
  "EMPLOYEE",
  "DELIVERY",
]);

export type VisitorType = z.infer<typeof visitorTypeSchema>;

/**
 * Public sign-in form schema
 */
export const signInSchema = z.object({
  slug: z.string().min(1, "Site slug is required"),
  visitorName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long"),
  visitorPhone: z
    .string()
    .min(6, "Phone number is too short")
    .max(20, "Phone number is too long")
    .regex(/^[\d\s\-+()]+$/, "Invalid phone number format"),
  visitorEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  employerName: z.string().max(100, "Employer name is too long").optional(),
  visitorType: visitorTypeSchema,
  roleOnSite: z.string().max(100, "Role description is too long").optional(),
  // Induction answers - answer can be any type but must be present
  answers: z.array(
    z
      .object({
        questionId: z.string().min(1, "Invalid question ID"),
        answer: z.unknown().transform((val) => val as unknown),
      })
      .transform((obj) => ({ questionId: obj.questionId, answer: obj.answer })),
  ),
  signatureData: z.string().optional(),
});

export type SignInInput = z.infer<typeof signInSchema>;

/**
 * Public sign-out schema
 */
export const signOutSchema = z.object({
  token: z.string().min(1, "Sign-out token is required"),
  phone: z
    .string()
    .min(6, "Phone number is required")
    .max(20, "Phone number is too long"),
});

export type SignOutInput = z.infer<typeof signOutSchema>;

// ============================================================================
// HISTORY FILTER SCHEMAS
// ============================================================================

/**
 * History filters schema
 *
 * SECURITY: Validates all inputs to prevent:
 * - SQL injection via malformed strings
 * - DoS via excessive page sizes
 * - Date manipulation attacks
 * - Invalid enum values
 */
export const historyFiltersSchema = z.object({
  siteId: z.string().cuid("Invalid site ID").optional(),
  employerName: z
    .string()
    .max(MAX_STRING_LENGTH, "Employer name too long")
    .optional(),
  visitorType: z
    .enum(["CONTRACTOR", "VISITOR", "EMPLOYEE", "DELIVERY"])
    .optional(),
  status: z.enum(["on_site", "signed_out", "all"]).optional(),
  dateFrom: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), "Invalid date format")
    .optional(),
  dateTo: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), "Invalid date format")
    .optional(),
  search: z.string().max(MAX_STRING_LENGTH, "Search term too long").optional(),
  page: z.number().int().positive().optional().default(1),
  pageSize: z
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE, `Page size cannot exceed ${MAX_PAGE_SIZE}`)
    .optional()
    .default(20),
});

export type HistoryFilters = z.infer<typeof historyFiltersSchema>;
