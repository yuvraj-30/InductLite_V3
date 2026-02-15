/**
 * Site Repository
 *
 * Handles all Site-related database operations with mandatory tenant scoping.
 */

import { scopedDb } from "@/lib/db/scoped-db";
import { publicDb } from "@/lib/db/public-db";
import type { Site, Prisma } from "@prisma/client";
import {
  requireCompanyId,
  handlePrismaError,
  normalizePagination,
  paginatedResult,
  RepositoryError,
  type PaginationParams,
  type PaginatedResult,
} from "./base";

/**
 * Site with related counts
 */
export interface SiteWithCounts extends Site {
  _count?: {
    sign_in_records: number;
    public_links: number;
  };
}

export type SiteListItem = Pick<
  Site,
  "id" | "name" | "address" | "description" | "is_active"
>;

export type SiteListWithCounts = SiteListItem & {
  _count: {
    sign_in_records: number;
    public_links: number;
  };
};

/**
 * Site filter options
 */
export interface SiteFilter {
  name?: string;
  address?: string;
  isActive?: boolean;
}

/**
 * Site creation input
 */
export interface CreateSiteInput {
  name: string;
  address?: string;
  description?: string;
  is_active?: boolean;
}

/**
 * Site update input
 */
export interface UpdateSiteInput {
  name?: string;
  address?: string;
  description?: string;
  is_active?: boolean;
}

/**
 * Find site by ID within a company
 */
export async function findSiteById(
  companyId: string,
  siteId: string,
): Promise<Site | null> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const site = await db.site.findFirst({
      where: { id: siteId, company_id: companyId },
    });
    return site;
  } catch (error) {
    handlePrismaError(error, "Site");
  }
}

/**
 * Find site by ID with counts
 */
export async function findSiteByIdWithCounts(
  companyId: string,
  siteId: string,
): Promise<SiteWithCounts | null> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.site.findFirst({
      where: { id: siteId, company_id: companyId },
      include: {
        _count: {
          select: {
            sign_in_records: true,
            public_links: true,
          },
        },
      },
    });
  } catch (error) {
    handlePrismaError(error, "Site");
  }
}

/**
 * Find site by public link slug
 * Used for public sign-in pages - returns site with company info
 */
export async function findSiteByPublicSlug(
  slug: string,
): Promise<(Site & { company: { id: string; name: string } }) | null> {
  try {
    // eslint-disable-next-line security-guardrails/require-company-id -- public lookup by unique slug
    const publicLink = await publicDb.sitePublicLink.findUnique({
      where: { slug },
      include: {
        site: {
          include: {
            company: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!publicLink || !publicLink.is_active || !publicLink.site.is_active) {
      return null;
    }

    // Check expiration
    if (publicLink.expires_at && publicLink.expires_at < new Date()) {
      return null;
    }

    return publicLink.site;
  } catch (error) {
    handlePrismaError(error, "Site");
  }
}

/**
 * List sites for a company with pagination and filtering
 */
export async function listSites(
  companyId: string,
  filter?: SiteFilter,
  pagination?: PaginationParams,
): Promise<PaginatedResult<SiteListItem>> {
  requireCompanyId(companyId);

  const { skip, take, page, pageSize } = normalizePagination(pagination ?? {});

  const where: Prisma.SiteWhereInput = {
    company_id: companyId,
    ...(filter?.name && {
      name: { contains: filter.name, mode: "insensitive" },
    }),
    ...(filter?.address && {
      address: { contains: filter.address, mode: "insensitive" },
    }),
    ...(filter?.isActive !== undefined && { is_active: filter.isActive }),
  };

  try {
    const db = scopedDb(companyId);

    const [sites, total] = await Promise.all([
      db.site.findMany({
        where,
        skip,
        take,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          address: true,
          description: true,
          is_active: true,
        },
      }),
      db.site.count({ where }),
    ]);

    return paginatedResult(sites, total, page, pageSize);
  } catch (error) {
    handlePrismaError(error, "Site");
  }
}

/**
 * List sites with counts for dashboard
 */
export async function listSitesWithCounts(
  companyId: string,
  filter?: SiteFilter,
  pagination?: PaginationParams,
): Promise<PaginatedResult<SiteListWithCounts>> {
  requireCompanyId(companyId);

  const { skip, take, page, pageSize } = normalizePagination(pagination ?? {});

  const where: Prisma.SiteWhereInput = {
    company_id: companyId,
    ...(filter?.name && {
      name: { contains: filter.name, mode: "insensitive" },
    }),
    ...(filter?.address && {
      address: { contains: filter.address, mode: "insensitive" },
    }),
    ...(filter?.isActive !== undefined && { is_active: filter.isActive }),
  };

  try {
    const db = scopedDb(companyId);

    const [sites, total] = await Promise.all([
      db.site.findMany({
        where,
        skip,
        take,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          address: true,
          description: true,
          is_active: true,
          _count: {
            select: {
              sign_in_records: true,
              public_links: true,
            },
          },
        },
      }),
      db.site.count({ where }),
    ]);

    return paginatedResult(sites, total, page, pageSize);
  } catch (error) {
    handlePrismaError(error, "Site");
  }
}

/**
 * List active public links for a set of sites, scoped by company via relation.
 */
export async function listActivePublicLinksForSites(
  companyId: string,
  siteIds: string[],
): Promise<Array<{ site_id: string; slug: string }>> {
  requireCompanyId(companyId);

  if (siteIds.length === 0) return [];

  try {
    return await publicDb.sitePublicLink.findMany({
      where: {
        site_id: { in: siteIds },
        is_active: true,
        site: { is: { company_id: companyId } },
      },
      select: { site_id: true, slug: true },
    });
  } catch (error) {
    handlePrismaError(error, "SitePublicLink");
  }
}

/**
 * Find active public link for a specific site (scoped by company via relation).
 */
export async function findActivePublicLinkForSite(
  companyId: string,
  siteId: string,
): Promise<{ site_id: string; slug: string } | null> {
  requireCompanyId(companyId);

  try {
    return await publicDb.sitePublicLink.findFirst({
      where: {
        site_id: siteId,
        is_active: true,
        site: { is: { company_id: companyId } },
      },
      select: { site_id: true, slug: true },
    });
  } catch (error) {
    handlePrismaError(error, "SitePublicLink");
  }
}

/**
 * Create a public link for a site (scoped by company via relation)
 */
export async function createPublicLinkForSite(
  companyId: string,
  siteId: string,
  slug: string,
): Promise<{ id: string; slug: string }> {
  requireCompanyId(companyId);

  try {
    return await publicDb.sitePublicLink.create({
      data: {
        site: { connect: { id: siteId } },
        slug,
        is_active: true,
      },
      select: { id: true, slug: true },
    });
  } catch (error) {
    handlePrismaError(error, "SitePublicLink");
  }
}

/**
 * Deactivate all active public links for a site (scoped by company via relation)
 */
export async function deactivatePublicLinksForSite(
  companyId: string,
  siteId: string,
): Promise<void> {
  requireCompanyId(companyId);

  try {
    await publicDb.sitePublicLink.updateMany({
      where: {
        site_id: siteId,
        is_active: true,
        site: { is: { company_id: companyId } },
      },
      data: { is_active: false, rotated_at: new Date() },
    });
  } catch (error) {
    handlePrismaError(error, "SitePublicLink");
  }
}

/**
 * Create a new site
 */
export async function createSite(
  companyId: string,
  input: CreateSiteInput,
): Promise<Site> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.site.create({
      data: {
        name: input.name,
        address: input.address,
        description: input.description,
        is_active: input.is_active ?? true,
      },
    });
  } catch (error) {
    handlePrismaError(error, "Site");
  }
}

/**
 * Update a site
 *
 * SECURITY: Uses updateMany with compound WHERE to prevent TOCTOU attacks.
 * The update is atomic - if the site doesn't belong to the company,
 * no rows are updated (fail-closed behavior).
 */
export async function updateSite(
  companyId: string,
  siteId: string,
  input: UpdateSiteInput,
): Promise<Site> {
  requireCompanyId(companyId);

  try {
    // Atomic update with tenant scoping in WHERE clause
    // This prevents TOCTOU: the check and update happen atomically
    const db = scopedDb(companyId);

    const result = await db.site.updateMany({
      where: { id: siteId, company_id: companyId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.is_active !== undefined && { is_active: input.is_active }),
      },
    });

    // Fail-closed: if no rows updated, the site doesn't exist or doesn't belong to company
    if (result.count === 0) {
      throw new RepositoryError("Site not found", "NOT_FOUND");
    }

    // Fetch and return the updated site
    const updated = await db.site.findFirst({
      where: { id: siteId, company_id: companyId },
    });

    if (!updated) {
      throw new RepositoryError("Site not found", "NOT_FOUND");
    }

    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "Site");
  }
}

/**
 * Deactivate a site (soft delete)
 */
export async function deactivateSite(
  companyId: string,
  siteId: string,
): Promise<Site> {
  return updateSite(companyId, siteId, { is_active: false });
}

/**
 * Reactivate a site
 */
export async function reactivateSite(
  companyId: string,
  siteId: string,
): Promise<Site> {
  return updateSite(companyId, siteId, { is_active: true });
}

/**
 * Count active sites in a company
 */
export async function countActiveSites(companyId: string): Promise<number> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.site.count({
      where: { company_id: companyId, is_active: true },
    });
  } catch (error) {
    handlePrismaError(error, "Site");
  }
}

/**
 * Get all site IDs for a company (for bulk operations)
 */
export async function getAllSiteIds(companyId: string): Promise<string[]> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const sites = await db.site.findMany({
      where: { company_id: companyId },
      select: { id: true },
    });

    return sites.map((s: { id: string }) => s.id);
  } catch (error) {
    handlePrismaError(error, "Site");
  }
}

/**
 * Find all sites for a company (no pagination, for admin lists)
 */
export async function findAllSites(companyId: string): Promise<SiteListItem[]> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.site.findMany({
      where: { company_id: companyId },
      select: {
        id: true,
        name: true,
        address: true,
        description: true,
        is_active: true,
      },
      orderBy: [{ is_active: "desc" }, { name: "asc" }],
    });
  } catch (error) {
    handlePrismaError(error, "Site");
  }
}

/**
 * Find a set of sites by ID for a company
 */
export async function findSitesByIds(
  companyId: string,
  siteIds: string[],
): Promise<SiteListItem[]> {
  requireCompanyId(companyId);
  if (siteIds.length === 0) return [];

  try {
    const db = scopedDb(companyId);
    return await db.site.findMany({
      where: { company_id: companyId, id: { in: siteIds } },
      select: {
        id: true,
        name: true,
        address: true,
        description: true,
        is_active: true,
      },
      orderBy: [{ is_active: "desc" }, { name: "asc" }],
    });
  } catch (error) {
    handlePrismaError(error, "Site");
  }
}
