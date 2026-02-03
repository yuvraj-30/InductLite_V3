/**
 * Tenant Module Barrel Export
 */

// Only export read-only context helpers for use in layouts/pages
// Write-enabled helpers should be imported directly from ./context when needed in server actions
export {
  getPublicContext,
  requirePublicContext,
  getTenantContext,
  extractCompanyId,
  isAuthenticatedContext,
  isPublicContext,
  isAdmin,
  // Read-only helpers for layouts/pages
  requireAuthenticatedContextReadOnly,
  requireCompanyIdReadOnly,
  validateResourceAccessReadOnly,
  assertResourceAccessReadOnly,
} from "./context";

export type {
  AuthenticatedTenantContext,
  PublicTenantContext,
  TenantContext,
} from "./context";
