/**
 * Site Manager Repository
 *
 * Handles Site Manager assignments with tenant scoping.
 */

import { scopedDb } from "@/lib/db/scoped-db";
import { requireCompanyId, handlePrismaError, RepositoryError } from "./base";

export async function listManagedSiteIds(
  companyId: string,
  userId: string,
): Promise<string[]> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const rows = await db.siteManagerAssignment.findMany({
      where: { company_id: companyId, user_id: userId },
      select: { site_id: true },
    });
    return rows.map((row: { site_id: string }) => row.site_id);
  } catch (error) {
    handlePrismaError(error, "SiteManagerAssignment");
  }
}

export async function isUserSiteManagerForSite(
  companyId: string,
  userId: string,
  siteId: string,
): Promise<boolean> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const assignment = await db.siteManagerAssignment.findFirst({
      where: { company_id: companyId, user_id: userId, site_id: siteId },
      select: { id: true },
    });
    return Boolean(assignment);
  } catch (error) {
    handlePrismaError(error, "SiteManagerAssignment");
  }
}

export async function assignSiteManager(
  companyId: string,
  userId: string,
  siteId: string,
): Promise<void> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    await db.siteManagerAssignment.create({
      data: {
        company_id: companyId,
        user_id: userId,
        site_id: siteId,
      },
    });
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "SiteManagerAssignment");
  }
}

export async function removeSiteManager(
  companyId: string,
  userId: string,
  siteId: string,
): Promise<number> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const result = await db.siteManagerAssignment.deleteMany({
      where: { company_id: companyId, user_id: userId, site_id: siteId },
    });
    return result.count;
  } catch (error) {
    handlePrismaError(error, "SiteManagerAssignment");
  }
}
