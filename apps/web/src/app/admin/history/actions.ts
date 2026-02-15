"use server";

/**
 * History Server Actions
 *
 * Handles paginated sign-in history with filters.
 * All inputs are validated with Zod to prevent injection and ensure data integrity.
 */

import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  listSignInHistory,
  getDistinctEmployers,
  findAllSites,
  type SignInFilter,
  type PaginatedResult,
  type SignInRecordWithDetails,
} from "@/lib/repository";
import {
  historyFiltersSchema,
  type HistoryFilters,
} from "@/lib/validation/schemas";
import { getUtcDayRangeForTimeZone } from "@/lib/time/day-range";

// Re-export for consumers
export type { HistoryFilters } from "@/lib/validation/schemas";

const DEFAULT_COMPANY_TIMEZONE = "Pacific/Auckland";

/**
 * Get paginated sign-in history with filters
 *
 * SECURITY: All inputs are validated before use.
 */
export async function getSignInHistoryAction(
  filters: HistoryFilters,
): Promise<PaginatedResult<SignInRecordWithDetails>> {
  const context = await requireAuthenticatedContextReadOnly();

  // Validate and sanitize input
  const parsed = historyFiltersSchema.safeParse(filters);
  if (!parsed.success) {
    // Return empty result for invalid input (fail-closed)
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    };
  }

  const validFilters = parsed.data;

  const signInFilter: SignInFilter = {
    siteId: validFilters.siteId,
    employerName: validFilters.employerName,
    visitorType: validFilters.visitorType,
    status: validFilters.status,
    search: validFilters.search,
  };

  // Parse date range with validated inputs
  if (validFilters.dateFrom || validFilters.dateTo) {
    const from = validFilters.dateFrom
      ? getUtcDayRangeForTimeZone(
          validFilters.dateFrom,
          DEFAULT_COMPANY_TIMEZONE,
        ).from
      : undefined;
    const to = validFilters.dateTo
      ? getUtcDayRangeForTimeZone(
          validFilters.dateTo,
          DEFAULT_COMPANY_TIMEZONE,
        ).to
      : undefined;

    signInFilter.dateRange = {
      from,
      to,
    };
  }

  return listSignInHistory(context.companyId, signInFilter, {
    page: validFilters.page,
    pageSize: validFilters.pageSize,
  });
}

interface Site {
  id: string;
  name: string;
  is_active: boolean;
}

/**
 * Get filter options for dropdowns
 */
export async function getHistoryFilterOptionsAction(): Promise<{
  sites: Array<{ id: string; name: string }>;
  employers: string[];
}> {
  const context = await requireAuthenticatedContextReadOnly();

  const [sites, employers] = (await Promise.all([
    findAllSites(context.companyId),
    getDistinctEmployers(context.companyId),
  ])) as [Site[], string[]];

  return {
    sites: sites.map((s) => ({ id: s.id, name: s.name })),
    employers,
  };
}
