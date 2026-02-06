/**
 * Tenant Context Utilities
 *
 * Provides helpers for deriving and validating tenant (company) context
 * in different scenarios:
 *
 * 1. Authenticated requests: Get company_id from session
 * 2. Public requests: Derive company_id from public slug
 * 3. API requests: Validate company_id matches session
 */

import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionUserReadOnly } from "@/lib/auth";
import { findSiteByPublicSlug } from "@/lib/repository";
import { RepositoryError } from "@/lib/repository/base";
import type { UserRole } from "@prisma/client";

/**
 * Tenant context for authenticated requests
 */
export interface AuthenticatedTenantContext {
  type: "authenticated";
  companyId: string;
  companyName: string;
  userId: string;
  userEmail: string;
  userName: string;
  role: UserRole;
}

/**
 * Tenant context for public requests (sign-in pages)
 */
export interface PublicTenantContext {
  type: "public";
  companyId: string;
  companyName: string;
  siteId: string;
  siteName: string;
}

/**
 * Union type for any tenant context
 */
export type TenantContext = AuthenticatedTenantContext | PublicTenantContext;

/**
 * Get authenticated tenant context from session
 * Returns null if not authenticated
 */
export const getAuthenticatedContext = cache(
  async (): Promise<AuthenticatedTenantContext | null> => {
    const user = await getSessionUserReadOnly();
    if (!user) {
      return null;
    }
    return {
      type: "authenticated",
      companyId: user.companyId,
      companyName: user.companyName,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      role: user.role,
    };
  },
);

/**
 * Require authenticated tenant context
 * Throws if not authenticated
 */
export async function requireAuthenticatedContextReadOnly(): Promise<AuthenticatedTenantContext> {
  const context = await getAuthenticatedContext();
  if (!context) {
    if (process.env.E2E_QUIET === "1") {
      redirect("/login");
    }
    throw new Error("Authentication required");
  }
  return context;
}

/**
 * Get company_id from authenticated session
 * Throws if not authenticated
 */
export async function requireCompanyIdReadOnly(): Promise<string> {
  const context = await requireAuthenticatedContextReadOnly();
  return context.companyId;
}

/**
 * Get public tenant context from site slug
 * Returns null if slug is invalid or site is inactive
 */
export async function getPublicContext(
  slug: string,
): Promise<PublicTenantContext | null> {
  try {
    const site = await findSiteByPublicSlug(slug);

    if (!site) {
      return null;
    }

    return {
      type: "public",
      companyId: site.company.id,
      companyName: site.company.name,
      siteId: site.id,
      siteName: site.name,
    };
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return null;
    }
    throw error;
  }
}

/**
 * Require public tenant context from site slug
 * Throws if slug is invalid or site is inactive
 */
export async function requirePublicContext(
  slug: string,
): Promise<PublicTenantContext> {
  const context = await getPublicContext(slug);

  if (!context) {
    throw new Error("Site not found or inactive");
  }

  return context;
}

/**
 * Validate that a resource belongs to the authenticated user's company
 * Returns true if valid, throws if not authenticated
 */
export async function validateResourceAccessReadOnly(
  resourceCompanyId: string,
): Promise<boolean> {
  const context = await requireAuthenticatedContextReadOnly();
  return context.companyId === resourceCompanyId;
}

/**
 * Assert that a resource belongs to the authenticated user's company
 * Throws if not authenticated or access denied
 */
export async function assertResourceAccessReadOnly(
  resourceCompanyId: string,
): Promise<void> {
  const context = await requireAuthenticatedContextReadOnly();
  if (context.companyId !== resourceCompanyId) {
    throw new Error("Access denied: resource belongs to different company");
  }
}

/**
 * Get the company_id for a request, either from session or public context
 */
export async function getTenantContext(options?: {
  publicSlug?: string;
}): Promise<TenantContext | null> {
  // First try authenticated context
  const authContext = await getAuthenticatedContext();
  if (authContext) {
    return authContext;
  }

  // Then try public context if slug is provided
  if (options?.publicSlug) {
    return getPublicContext(options.publicSlug);
  }

  return null;
}

/**
 * Extract company_id from any tenant context
 */
export function extractCompanyId(context: TenantContext): string {
  return context.companyId;
}

/**
 * Check if context is authenticated
 */
export function isAuthenticatedContext(
  context: TenantContext,
): context is AuthenticatedTenantContext {
  return context.type === "authenticated";
}

/**
 * Check if context is public
 */
export function isPublicContext(
  context: TenantContext,
): context is PublicTenantContext {
  return context.type === "public";
}

/**
 * Check if user has admin role in context
 */
export function isAdmin(context: TenantContext): boolean {
  return isAuthenticatedContext(context) && context.role === "ADMIN";
}
