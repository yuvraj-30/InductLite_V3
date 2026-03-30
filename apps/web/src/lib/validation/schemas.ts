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
export const MAX_SIGNIN_ANSWERS = 50;
export const MAX_SIGNIN_ANSWER_STRING_LENGTH = 5000;
export const MAX_SIGNATURE_DATA_LENGTH = 2_000_000;
export const MAX_VISITOR_IDENTITY_EVIDENCE_LENGTH = 2_000_000;
const IMAGE_DATA_URL_REGEX =
  /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i;

const answerValueSchema = z.union([
  z.string().max(MAX_SIGNIN_ANSWER_STRING_LENGTH, "Answer is too long"),
  z.number(),
  z.boolean(),
  z.null(),
  z
    .array(
      z.union([
        z.string().max(MAX_SIGNIN_ANSWER_STRING_LENGTH, "Answer is too long"),
        z.number(),
        z.boolean(),
        z.null(),
      ]),
    )
    .max(MAX_SIGNIN_ANSWERS, `Too many answer selections (max ${MAX_SIGNIN_ANSWERS})`),
]);
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const historyDateSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();

    if (!trimmed) return undefined;
    if (DATE_ONLY_REGEX.test(trimmed)) return trimmed;

    const parsedTs = Date.parse(trimmed);
    if (!Number.isNaN(parsedTs)) {
      return new Date(parsedTs).toISOString().slice(0, 10);
    }

    return trimmed;
  },
  z
    .string()
    .regex(DATE_ONLY_REGEX, "Invalid date format (YYYY-MM-DD required)")
    .optional(),
);

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
  hasAcceptedTerms: z
    .boolean()
    .refine((accepted) => accepted === true, "You must accept the terms to sign in"),
  // Induction answers - bounded to prevent payload-amplification abuse
  answers: z
    .array(
      z.object({
        questionId: z.string().cuid("Invalid question ID"),
        answer: answerValueSchema,
      }),
    )
    .max(MAX_SIGNIN_ANSWERS, `Too many answers (max ${MAX_SIGNIN_ANSWERS})`),
  signatureData: z
    .string()
    .max(
      MAX_SIGNATURE_DATA_LENGTH,
      `Signature payload exceeds ${MAX_SIGNATURE_DATA_LENGTH} characters`,
    )
    .optional(),
  visitorPhotoDataUrl: z
    .string()
    .max(
      MAX_VISITOR_IDENTITY_EVIDENCE_LENGTH,
      `Visitor photo exceeds ${MAX_VISITOR_IDENTITY_EVIDENCE_LENGTH} characters`,
    )
    .regex(IMAGE_DATA_URL_REGEX, "Visitor photo must be a PNG/JPEG/WEBP image data URL")
    .optional(),
  visitorIdDataUrl: z
    .string()
    .max(
      MAX_VISITOR_IDENTITY_EVIDENCE_LENGTH,
      `Visitor ID image exceeds ${MAX_VISITOR_IDENTITY_EVIDENCE_LENGTH} characters`,
    )
    .regex(
      IMAGE_DATA_URL_REGEX,
      "Visitor ID image must be a PNG/JPEG/WEBP image data URL",
    )
    .optional(),
  visitorIdType: z.string().trim().max(60, "ID type is too long").optional(),
  identityConsentAccepted: z.boolean().optional(),
  location: z
    .object({
      latitude: z.number().min(-90, "Invalid latitude").max(90, "Invalid latitude"),
      longitude: z
        .number()
        .min(-180, "Invalid longitude")
        .max(180, "Invalid longitude"),
      accuracyMeters: z
        .number()
        .min(0, "Invalid location accuracy")
        .max(10_000, "Invalid location accuracy")
        .optional(),
      capturedAt: z.string().datetime().optional(),
    })
    .optional(),
  inviteToken: z
    .string()
    .min(16, "Invalid invite token")
    .max(64, "Invalid invite token")
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid invite token")
    .optional(),
  hostRecipientId: z.string().cuid("Invalid host recipient").optional(),
  languageCode: z
    .string()
    .min(2, "Invalid language code")
    .max(20, "Invalid language code")
    .regex(
      /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/,
      "Invalid language code",
    )
    .optional(),
  mediaAcknowledged: z.boolean().optional(),
  geofenceOverrideCode: z
    .string()
    .min(4, "Invalid geofence override code")
    .max(64, "Invalid geofence override code")
    .optional(),
  idempotencyKey: z
    .string()
    .min(16, "Invalid idempotency key")
    .max(128, "Invalid idempotency key")
    .optional(),
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
// EXPORT SCHEMAS
// ============================================================================

export const exportTypeSchema = z.enum([
  "SIGN_IN_CSV",
  "INDUCTION_CSV",
  "SITE_PACK_PDF",
  "COMPLIANCE_ZIP",
]);

export const createExportSchema = z.object({
  exportType: exportTypeSchema,
  siteId: z.string().cuid("Invalid site ID").optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  contractorIds: z.array(z.string().cuid("Invalid contractor ID")).optional(),
}).superRefine((value, ctx) => {
  if (value.contractorIds && value.contractorIds.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["contractorIds"],
      message: "Contractor filters are not supported for exports yet.",
    });
  }

  if (!value.dateFrom || !value.dateTo) {
    return;
  }

  const from = new Date(value.dateFrom);
  const to = new Date(value.dateTo);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return;
  }

  if (from > to) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dateFrom"],
      message: "'From' must be earlier than or equal to 'To'.",
    });
  }
});

export type CreateExportInput = z.infer<typeof createExportSchema>;

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
  dateFrom: historyDateSchema,
  dateTo: historyDateSchema,
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
