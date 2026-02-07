/**
 * RBAC Guards
 *
 * Role-based access control enforcement for server-side operations.
 *
 * ROLES:
 * - ADMIN: Full access to company resources, can manage users
 * - VIEWER: Read-only access to company data
 *
 * All guards require authentication first, then check role permissions.
 */

import { redirect } from "next/navigation";
import { getSessionUser } from "./session";
import type { SessionUser } from "./session-config";
import type { UserRole } from "@prisma/client";

export type Permission =
  | "user:manage" // Create, update, delete users
  | "site:manage" // Create, update, delete sites
  | "template:manage" // Create, update, delete induction templates
  | "contractor:manage" // Create, update, delete contractors
  | "export:create" // Create data exports
  | "settings:manage" // Manage company settings
  | "audit:read"; // View audit logs

/**
 * Permission matrix: which roles have which permissions
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    "user:manage",
    "site:manage",
    "template:manage",
    "contractor:manage",
    "export:create",
    "settings:manage",
    "audit:read",
  ],
  SITE_MANAGER: ["site:manage", "contractor:manage", "export:create"],
  VIEWER: [
    // Viewers can only read, no write permissions
    // They can view data via normal page access
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Guard result type for server actions
 */
export type GuardResult =
  | { success: true; user: SessionUser }
  | { success: false; error: string; code: "UNAUTHENTICATED" | "FORBIDDEN" };

/**
 * Check if user is authenticated and return user data
 * For use in server actions where you need the result, not a redirect
 */
export async function checkAuth(): Promise<GuardResult> {
  const user = await getSessionUser();

  if (!user) {
    return {
      success: false,
      error: "Authentication required",
      code: "UNAUTHENTICATED",
    };
  }

  return { success: true, user };
}

/**
 * Check if user is admin and return user data
 * For use in server actions where you need the result, not a redirect
 */
export async function checkAdmin(): Promise<GuardResult> {
  const authResult = await checkAuth();

  if (!authResult.success) {
    return authResult;
  }

  if (authResult.user.role !== "ADMIN") {
    return {
      success: false,
      error: "Admin access required",
      code: "FORBIDDEN",
    };
  }

  return authResult;
}

/**
 * Check if user has a specific permission
 * For use in server actions where you need the result, not a redirect
 */
export async function checkPermission(
  permission: Permission,
): Promise<GuardResult> {
  const authResult = await checkAuth();

  if (!authResult.success) {
    return authResult;
  }

  if (!hasPermission(authResult.user.role, permission)) {
    return {
      success: false,
      error: `Permission denied: ${permission}`,
      code: "FORBIDDEN",
    };
  }

  return authResult;
}

/**
 * Check if user has a permission for a specific site
 * Enforces site assignment for SITE_MANAGER role.
 */
export async function checkSitePermission(
  permission: Permission,
  siteId: string,
): Promise<GuardResult> {
  const authResult = await checkAuth();
  if (!authResult.success) {
    return authResult;
  }

  const { user } = authResult;
  if (!hasPermission(user.role, permission)) {
    return {
      success: false,
      error: `Permission denied: ${permission}`,
      code: "FORBIDDEN",
    };
  }

  if (user.role === "SITE_MANAGER") {
    const { isUserSiteManagerForSite } =
      await import("@/lib/repository/site-manager.repository");
    const allowed = await isUserSiteManagerForSite(
      user.companyId,
      user.id,
      siteId,
    );
    if (!allowed) {
      return {
        success: false,
        error: "Permission denied: site access",
        code: "FORBIDDEN",
      };
    }
  }

  return authResult;
}

/**
 * Require authentication for a page
 * Redirects to login if not authenticated
 * For use in page.tsx files
 */
export async function requireAuthPage(
  redirectTo = "/login",
): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    redirect(redirectTo);
  }

  return user;
}

/**
 * Require admin role for a page
 * Redirects to login if not authenticated, to /unauthorized if not admin
 * For use in page.tsx files
 */
export async function requireAdminPage(): Promise<SessionUser> {
  const user = await requireAuthPage();

  if (user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  return user;
}

/**
 * Require a specific permission for a page
 * Redirects appropriately if check fails
 * For use in page.tsx files
 */
export async function requirePermissionPage(
  permission: Permission,
): Promise<SessionUser> {
  const user = await requireAuthPage();

  if (!hasPermission(user.role, permission)) {
    redirect("/unauthorized");
  }

  return user;
}

/**
 * Require authentication for a page (read-only, for layouts/pages)
 * Redirects to login if not authenticated
 * Does NOT update lastActivity or write cookies
 */
export async function requireAuthPageReadOnly(
  redirectTo = "/login",
): Promise<SessionUser> {
  const { getSessionUserReadOnly } = await import("./session");
  const user = await getSessionUserReadOnly();
  if (!user) {
    redirect(redirectTo);
  }
  return user;
}

/**
 * Require admin role for a page (read-only, for layouts/pages)
 * Redirects to login if not authenticated, to /unauthorized if not admin
 */
export async function requireAdminPageReadOnly(): Promise<SessionUser> {
  const user = await requireAuthPageReadOnly();
  if (user.role !== "ADMIN") {
    redirect("/unauthorized");
  }
  return user;
}

/**
 * Check if user is authenticated (read-only, for layouts/pages)
 * For use in pages/layouts where you need the result, not a redirect
 */
export async function checkAuthReadOnly(): Promise<GuardResult> {
  const { getSessionUserReadOnly } = await import("./session");
  const user = await getSessionUserReadOnly();
  if (!user) {
    return {
      success: false,
      error: "Authentication required",
      code: "UNAUTHENTICATED",
    };
  }
  return { success: true, user };
}

/**
 * Check if user has a specific permission (read-only, for layouts/pages)
 * For use in pages/layouts where you need the result, not a redirect
 */
export async function checkPermissionReadOnly(
  permission: Permission,
): Promise<GuardResult> {
  const authResult = await checkAuthReadOnly();
  if (!authResult.success) {
    return authResult;
  }
  if (!hasPermission(authResult.user.role, permission)) {
    return {
      success: false,
      error: `Permission denied: ${permission}`,
      code: "FORBIDDEN",
    };
  }
  return authResult;
}

/**
 * Check if user has a permission for a specific site (read-only)
 */
export async function checkSitePermissionReadOnly(
  permission: Permission,
  siteId: string,
): Promise<GuardResult> {
  const authResult = await checkAuthReadOnly();
  if (!authResult.success) {
    return authResult;
  }

  const { user } = authResult;
  if (!hasPermission(user.role, permission)) {
    return {
      success: false,
      error: `Permission denied: ${permission}`,
      code: "FORBIDDEN",
    };
  }

  if (user.role === "SITE_MANAGER") {
    const { isUserSiteManagerForSite } =
      await import("@/lib/repository/site-manager.repository");
    const allowed = await isUserSiteManagerForSite(
      user.companyId,
      user.id,
      siteId,
    );
    if (!allowed) {
      return {
        success: false,
        error: "Permission denied: site access",
        code: "FORBIDDEN",
      };
    }
  }

  return authResult;
}

/**
 * Ensure company_id matches the user's company
 * Prevents cross-tenant access
 */
export function validateCompanyAccess(
  user: SessionUser,
  companyId: string,
): boolean {
  return user.companyId === companyId;
}

/**
 * Assert company access or throw
 */
export function assertCompanyAccess(
  user: SessionUser,
  companyId: string,
): void {
  if (!validateCompanyAccess(user, companyId)) {
    throw new Error("Access denied: resource belongs to different company");
  }
}
