/**
 * Sign-In Record Repository
 *
 * Handles sign-in/sign-out records with tenant scoping.
 * All queries are optimized with appropriate indexes.
 *
 * INDEX USAGE:
 * - Live register (on-site): Uses @@index([company_id, sign_out_ts]) for filtering null sign_out_ts
 * - History by date: Uses @@index([company_id, sign_in_ts]) for date range queries
 * - Site-specific queries: Uses @@index([company_id, site_id]) for site filtering
 * - Sign-out token lookup: Uses @@index([sign_out_token]) for self-service sign-out
 */

import { scopedDb } from "@/lib/db/scoped-db";
import { Prisma } from "@prisma/client";
import {
  requireCompanyId,
  handlePrismaError,
  normalizePagination,
  paginatedResult,
  buildDateRangeFilter,
  RepositoryError,
  type PaginationParams,
  type PaginatedResult,
  type DateRangeFilter,
} from "./base";
import { parsePhoneNumberFromString } from "libphonenumber-js";

// Infer types from Prisma schema
type SignInRecord = Prisma.SignInRecordGetPayload<object>;
type VisitorType = SignInRecord["visitor_type"];

/**
 * Sign-in record with related data
 */
export interface SignInRecordWithDetails {
  id: string;
  company_id: string;
  site_id: string;
  visitor_name: string;
  visitor_phone: string;
  visitor_email: string | null;
  employer_name: string | null;
  visitor_type: VisitorType;
  sign_in_ts: Date;
  sign_out_ts: Date | null;
  signed_out_by: string | null;
  sign_out_token: string | null;
  sign_out_token_exp: Date | null;
  notes: string | null;
  created_at: Date;
  site: {
    id: string;
    name: string;
  };
}

// Re-export VisitorType for use in other files
export type { VisitorType };

/**
 * Filter options for sign-in history queries
 */
export interface SignInFilter {
  siteId?: string;
  employerName?: string;
  visitorType?: VisitorType;
  status?: "on_site" | "signed_out" | "all";
  dateRange?: DateRangeFilter;
  search?: string; // Search visitor name or employer
}

/**
 * Input for creating a sign-in record
 */
export interface CreateSignInInput {
  site_id: string;
  visitor_name: string;
  visitor_phone: string;
  visitor_email?: string;
  employer_name?: string;
  visitor_type?: VisitorType;
  notes?: string;
}

/**
 * Find a sign-in record by ID (tenant-scoped)
 */
export async function findSignInById(
  companyId: string,
  signInId: string,
): Promise<SignInRecordWithDetails | null> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.signInRecord.findFirst({
      where: { id: signInId, company_id: companyId },
      include: {
        site: {
          select: { id: true, name: true },
        },
      },
    });
  } catch (error) {
    handlePrismaError(error, "SignInRecord");
  }
}

/**
 * List people currently on-site (sign_out_ts is null)
 * Uses index: @@index([company_id, sign_out_ts])
 */
export async function listCurrentlyOnSite(
  companyId: string,
  siteId?: string,
  limit: number = 100,
): Promise<SignInRecordWithDetails[]> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);

    const where: Prisma.SignInRecordWhereInput = {
      company_id: companyId,
      sign_out_ts: null, // Currently on site
    };

    if (siteId) {
      where.site_id = siteId;
    }

    const safeLimit = Math.max(1, Math.min(limit, 100));

    return await db.signInRecord.findMany({
      where,
      include: {
        site: {
          select: { id: true, name: true },
        },
      },
      orderBy: { sign_in_ts: "desc" },
      take: safeLimit,
    });
  } catch (error) {
    handlePrismaError(error, "SignInRecord");
  }
}

/**
 * List recent sign-ins for a site
 */
export async function listRecentSignInsForSite(
  companyId: string,
  siteId: string,
  limit: number = 10,
): Promise<SignInRecord[]> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.signInRecord.findMany({
      where: { company_id: companyId, site_id: siteId },
      orderBy: { sign_in_ts: "desc" },
      take: limit,
    });
  } catch (error) {
    handlePrismaError(error, "SignInRecord");
  }
}

/**
 * Count people currently on-site
 */
export async function countCurrentlyOnSite(
  companyId: string,
  siteId?: string,
): Promise<number> {
  requireCompanyId(companyId);

  const where: Prisma.SignInRecordWhereInput = {
    company_id: companyId,
    sign_out_ts: null,
  };

  if (siteId) {
    where.site_id = siteId;
  }

  const db = scopedDb(companyId);
  return await db.signInRecord.count({ where });
}

/**
 * List sign-in history with filters and pagination
 * Uses indexes based on filter combination:
 * - Date range: @@index([company_id, sign_in_ts])
 * - Site filter: @@index([company_id, site_id])
 * - Status filter: @@index([company_id, sign_out_ts])
 */
export async function listSignInHistory(
  companyId: string,
  filter: SignInFilter = {},
  pagination: PaginationParams = {},
): Promise<PaginatedResult<SignInRecordWithDetails>> {
  requireCompanyId(companyId);

  const { skip, take, page, pageSize } = normalizePagination(pagination);

  // Build where clause
  const where: Prisma.SignInRecordWhereInput = {
    company_id: companyId,
  };

  // Site filter - uses @@index([company_id, site_id])
  if (filter.siteId) {
    where.site_id = filter.siteId;
  }

  // Employer filter
  if (filter.employerName) {
    where.employer_name = {
      contains: filter.employerName,
      mode: "insensitive",
    };
  }

  // Visitor type filter
  if (filter.visitorType) {
    where.visitor_type = filter.visitorType;
  }

  // Status filter - uses @@index([company_id, sign_out_ts])
  if (filter.status === "on_site") {
    where.sign_out_ts = null;
  } else if (filter.status === "signed_out") {
    where.sign_out_ts = { not: null };
  }
  // 'all' doesn't add any filter

  // Date range filter - uses @@index([company_id, sign_in_ts])
  const dateFilter = buildDateRangeFilter(filter.dateRange);
  if (dateFilter) {
    where.sign_in_ts = dateFilter;
  }

  // Search filter (visitor name or employer)
  if (filter.search) {
    where.OR = [
      { visitor_name: { contains: filter.search, mode: "insensitive" } },
      { employer_name: { contains: filter.search, mode: "insensitive" } },
    ];
  }

  try {
    const db = scopedDb(companyId);

    const [items, total] = await Promise.all([
      db.signInRecord.findMany({
        where,
        include: {
          site: {
            select: { id: true, name: true },
          },
        },
        orderBy: { sign_in_ts: "desc" },
        skip,
        take,
      }),
      db.signInRecord.count({ where }),
    ]);

    return paginatedResult(items, total, page, pageSize);
  } catch (error) {
    handlePrismaError(error, "SignInRecord");
  }
}

/**
 * Create a sign-in record
 */
export async function createSignIn(
  companyId: string,
  input: CreateSignInInput,
): Promise<SignInRecord> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);

    // Normalize and validate visitor phone to E.164
    let formattedPhone = input.visitor_phone;
    try {
      const pn = parsePhoneNumberFromString(input.visitor_phone, "NZ");
      if (!pn || !pn.isValid()) {
        throw new RepositoryError("Invalid phone number", "VALIDATION");
      }
      formattedPhone = pn.number;
    } catch {
      throw new RepositoryError("Invalid phone number", "VALIDATION");
    }

    return await db.signInRecord.create({
      data: {
        site_id: input.site_id,
        visitor_name: input.visitor_name,
        visitor_phone: formattedPhone,
        visitor_email: input.visitor_email,
        employer_name: input.employer_name,
        visitor_type: input.visitor_type ?? "CONTRACTOR",
        notes: input.notes,
      },
    });
  } catch (error) {
    handlePrismaError(error, "SignInRecord");
  }
}

/**
 * Sign out a visitor (admin action)
 *
 * SECURITY: Uses updateMany with compound WHERE to prevent TOCTOU attacks.
 * The update is atomic - if the record doesn't belong to the company or
 * the visitor has already signed out, no rows are updated (fail-closed).
 *
 * @param signedOutBy - User ID who performed the sign-out (null for self sign-out)
 */
export async function signOutVisitor(
  companyId: string,
  signInId: string,
  signedOutBy?: string,
): Promise<SignInRecord> {
  requireCompanyId(companyId);

  try {
    // Atomic update with tenant scoping AND sign_out_ts check in WHERE clause
    // This prevents TOCTOU: the ownership check, status check, and update happen atomically
    const db = scopedDb(companyId);

    const result = await db.signInRecord.updateMany({
      where: { id: signInId, company_id: companyId, sign_out_ts: null },
      data: {
        sign_out_ts: new Date(),
        signed_out_by: signedOutBy ?? null,
      },
    });

    // Fail-closed: if no rows updated, either record doesn't exist,
    // doesn't belong to company, or already signed out
    if (result.count === 0) {
      // Determine the specific error by checking if record exists
      const existing = await db.signInRecord.findFirst({
        where: { id: signInId, company_id: companyId },
        select: { sign_out_ts: true },
      });

      if (!existing) {
        throw new RepositoryError("SignInRecord not found", "NOT_FOUND");
      }

      if (existing.sign_out_ts) {
        throw new RepositoryError(
          "Visitor has already signed out",
          "VALIDATION",
        );
      }

      // Shouldn't reach here, but fail-closed
      throw new RepositoryError("SignInRecord not found", "NOT_FOUND");
    }

    // Fetch and return the updated record
    const updated = await db.signInRecord.findFirst({
      where: { id: signInId, company_id: companyId },
    });

    if (!updated) {
      throw new RepositoryError("SignInRecord not found", "NOT_FOUND");
    }

    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "SignInRecord");
  }
}

/**
 * Get distinct employer names for autocomplete
 */
export async function getDistinctEmployers(
  companyId: string,
  limit = 50,
): Promise<string[]> {
  requireCompanyId(companyId);

  const db = scopedDb(companyId);
  const results = await db.signInRecord.findMany({
    where: { company_id: companyId, employer_name: { not: null } },
    select: { employer_name: true },
    distinct: ["employer_name"],
    take: limit,
    orderBy: { employer_name: "asc" },
  });

  return results
    .map((r: { employer_name: string | null }) => r.employer_name)
    .filter((name: string | null): name is string => name !== null);
}

/**
 * Get sign-in statistics for a date range
 */
export async function getSignInStats(
  companyId: string,
  dateRange?: DateRangeFilter,
): Promise<{
  total: number;
  byVisitorType: Record<VisitorType, number>;
  averageDuration: number | null;
}> {
  requireCompanyId(companyId);

  const where: Prisma.SignInRecordWhereInput = {
    company_id: companyId,
  };

  const dateFilter = buildDateRangeFilter(dateRange);
  if (dateFilter) {
    where.sign_in_ts = dateFilter;
  }

  const db = scopedDb(companyId);
  const [total, byType, completedRecords] = await Promise.all([
    db.signInRecord.count({ where }),

    db.signInRecord.groupBy({
      by: ["visitor_type"],
      where,
      _count: { id: true },
    }),
    // eslint-disable-next-line security-guardrails/require-company-id -- company_id is enforced by scopedDb
    db.signInRecord.findMany({
      where: {
        ...where,
        sign_out_ts: { not: null },
      },
      select: {
        sign_in_ts: true,
        sign_out_ts: true,
      },
    }),
  ]);

  // Calculate average duration in minutes
  let averageDuration: number | null = null;
  if (completedRecords.length > 0) {
    const totalMinutes = completedRecords.reduce(
      (sum: number, record: { sign_in_ts: Date; sign_out_ts: Date | null }) => {
        const duration =
          (record.sign_out_ts!.getTime() - record.sign_in_ts.getTime()) /
          (1000 * 60);
        return sum + duration;
      },
      0,
    );
    averageDuration = Math.round(totalMinutes / completedRecords.length);
  }

  // Build byVisitorType map
  const byVisitorType: Record<VisitorType, number> = {
    CONTRACTOR: 0,
    VISITOR: 0,
    EMPLOYEE: 0,
    DELIVERY: 0,
  };
  byType.forEach(
    (item: { visitor_type: VisitorType; _count: { id: number } }) => {
      byVisitorType[item.visitor_type] = item._count.id;
    },
  );

  return { total, byVisitorType, averageDuration };
}
