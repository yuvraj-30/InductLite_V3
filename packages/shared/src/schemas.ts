/**
 * Shared Zod schemas for validation
 */
import { z } from "zod";

// ============================================================================
// AUTH SCHEMAS
// ============================================================================

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ============================================================================
// SITE SCHEMAS
// ============================================================================

export const createSiteSchema = z.object({
  name: z.string().min(1, "Site name is required").max(200),
  address: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  inductionTemplateId: z.string().optional(),
});

export const updateSiteSchema = createSiteSchema.partial();

// ============================================================================
// INDUCTION TEMPLATE SCHEMAS
// ============================================================================

export const questionTypeSchema = z.enum([
  "TEXT",
  "MULTIPLE_CHOICE",
  "CHECKBOX",
  "YES_NO",
  "ACKNOWLEDGMENT",
]);

export const createQuestionSchema = z.object({
  questionText: z.string().min(1, "Question text is required").max(1000),
  questionType: questionTypeSchema,
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().default(true),
  displayOrder: z.number().int().min(0),
  correctAnswer: z.unknown().optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(200),
  description: z.string().max(2000).optional(),
  questions: z.array(createQuestionSchema).optional(),
});

export const updateTemplateSchema = createTemplateSchema.partial();

// ============================================================================
// CONTRACTOR SCHEMAS
// ============================================================================

export const createContractorSchema = z.object({
  name: z.string().min(1, "Contractor name is required").max(200),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(50).optional(),
  trade: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateContractorSchema = createContractorSchema.partial();

// ============================================================================
// SIGN-IN SCHEMAS
// ============================================================================

export const visitorTypeSchema = z.enum([
  "CONTRACTOR",
  "VISITOR",
  "EMPLOYEE",
  "DELIVERY",
]);

import { isValidPhoneE164 } from "./utils";

export const publicSignInSchema = z.object({
  visitorName: z.string().min(1, "Name is required").max(200),
  visitorPhone: z
    .string()
    .min(1, "Phone number is required")
    .refine(
      (v) => {
        try {
          return isValidPhoneE164(v, "NZ");
        } catch {
          return /^\+?[\d\s-()]+$/.test(v);
        }
      },
      {
        message:
          "Invalid phone number. Use international format, e.g., +64 21 123 4567",
      },
    ),
  visitorEmail: z.string().email().optional().or(z.literal("")),
  employerName: z.string().max(200).optional(),
  visitorType: visitorTypeSchema.default("CONTRACTOR"),
});

export const inductionAnswerSchema = z.object({
  questionId: z.string(),
  answer: z.unknown(),
});

export const submitInductionSchema = z.object({
  answers: z.array(inductionAnswerSchema),
});

export const signOutSchema = z.object({
  token: z.string().min(1, "Sign-out token is required"),
});

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
  siteId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  contractorIds: z.array(z.string()).optional(),
});

// ============================================================================
// PAGINATION SCHEMAS
// ============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const signInHistoryFilterSchema = paginationSchema.extend({
  siteId: z.string().optional(),
  employerName: z.string().optional(),
  visitorType: visitorTypeSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.enum(["active", "completed", "all"]).default("all"),
});
