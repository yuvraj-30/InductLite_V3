/**
 * Shared TypeScript types for InductLite
 */
import { z } from "zod";
import {
  loginSchema,
  changePasswordSchema,
  createSiteSchema,
  createTemplateSchema,
  createContractorSchema,
  publicSignInSchema,
  submitInductionSchema,
  createExportSchema,
  paginationSchema,
  signInHistoryFilterSchema,
} from "./schemas";

// ============================================================================
// INFERRED TYPES FROM ZOD SCHEMAS
// ============================================================================

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type CreateContractorInput = z.infer<typeof createContractorSchema>;
export type PublicSignInInput = z.infer<typeof publicSignInSchema>;
export type SubmitInductionInput = z.infer<typeof submitInductionSchema>;
export type CreateExportInput = z.infer<typeof createExportSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type SignInHistoryFilter = z.infer<typeof signInHistoryFilterSchema>;

// ============================================================================
// SESSION TYPES
// ============================================================================

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "VIEWER";
  companyId: string;
  companyName: string;
}

export interface Session {
  user: SessionUser;
  expiresAt: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

export interface DashboardKPIs {
  activeSites: number;
  currentlyOnSite: number;
  signInsToday: number;
  signIns7Days: number;
  docsExpiringIn30Days: number;
  expiredDocs: number;
}

// ============================================================================
// EXPORT JOB TYPES
// ============================================================================

export interface ExportJobStatus {
  id: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  exportType: string;
  fileName?: string;
  fileSize?: number;
  errorMessage?: string;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  downloadUrl?: string;
}

// ============================================================================
// DOCUMENT STATUS TYPES
// ============================================================================

export type DocumentStatus = "valid" | "expiring" | "expired" | "missing";

export interface ContractorDocumentSummary {
  contractorId: string;
  contractorName: string;
  validDocs: number;
  expiringDocs: number;
  expiredDocs: number;
  missingDocTypes: string[];
}
