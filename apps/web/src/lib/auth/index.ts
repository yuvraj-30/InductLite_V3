/**
 * Auth module barrel export
 */

// Password utilities
export { hashPassword, verifyPassword, needsRehash } from "./password";

// Session management
export {
  getSession,
  getSessionUser,
  getSessionUserReadOnly,
  login,
  logout,
  changePassword,
  requireAuth,
  requireAdmin,
} from "./session";

// Session types and config
export type { SessionUser, SessionData } from "./session-config";
export { sessionOptions } from "./session-config";

// CSRF utilities
export {
  generateRequestId,
  generateCsrfToken,
  validateOrigin,
  assertOrigin,
  validateCsrfToken,
  getClientIp,
  getUserAgent,
} from "./csrf";

// RBAC guards
export {
  hasPermission,
  getRolePermissions,
  checkAuth,
  checkAdmin,
  checkPermission,
  checkSitePermission,
  requireAuthPage,
  requireAdminPage,
  requirePermissionPage,
  validateCompanyAccess,
  assertCompanyAccess,
  // Read-only guards for layouts/pages
  requireAuthPageReadOnly,
  requireAdminPageReadOnly,
  checkAuthReadOnly,
  checkPermissionReadOnly,
  checkSitePermissionReadOnly,
} from "./guards";

export type { Permission, GuardResult } from "./guards";

// Sign-out token utilities (public endpoints)
export {
  generateSignOutToken,
  verifySignOutToken,
  hashPhone,
} from "./sign-out-token";

export type { SignOutTokenPayload } from "./sign-out-token";
