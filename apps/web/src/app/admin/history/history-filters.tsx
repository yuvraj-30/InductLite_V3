"use client";

/**
 * History Filter Form Component
 *
 * Client component for filtering sign-in history.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface HistoryFiltersFormProps {
  sites: Array<{ id: string; name: string }>;
  employers: string[];
}

export function HistoryFiltersForm({
  sites,
  employers,
}: HistoryFiltersFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilters = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });

      // Reset to page 1 when filters change
      params.set("page", "1");

      router.push(`/admin/history?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Site Filter */}
        <div>
          <label
            htmlFor="site"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Site
          </label>
          <select
            id="site"
            defaultValue={searchParams.get("site") || ""}
            onChange={(e) =>
              updateFilters({ site: e.target.value || undefined })
            }
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="">All Sites</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Status
          </label>
          <select
            id="status"
            defaultValue={searchParams.get("status") || "all"}
            onChange={(e) =>
              updateFilters({ status: e.target.value || undefined })
            }
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="all">All</option>
            <option value="on_site">Currently On Site</option>
            <option value="signed_out">Signed Out</option>
          </select>
        </div>

        {/* Visitor Type Filter */}
        <div>
          <label
            htmlFor="visitorType"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Visitor Type
          </label>
          <select
            id="visitorType"
            defaultValue={searchParams.get("visitorType") || ""}
            onChange={(e) =>
              updateFilters({ visitorType: e.target.value || undefined })
            }
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="">All Types</option>
            <option value="CONTRACTOR">Contractor</option>
            <option value="VISITOR">Visitor</option>
            <option value="EMPLOYEE">Employee</option>
            <option value="DELIVERY">Delivery</option>
          </select>
        </div>

        {/* Employer Filter */}
        <div>
          <label
            htmlFor="employer"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Employer
          </label>
          <select
            id="employer"
            defaultValue={searchParams.get("employer") || ""}
            onChange={(e) =>
              updateFilters({ employer: e.target.value || undefined })
            }
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="">All Employers</option>
            {employers.map((employer) => (
              <option key={employer} value={employer}>
                {employer}
              </option>
            ))}
          </select>
        </div>

        {/* Date From */}
        <div>
          <label
            htmlFor="dateFrom"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            From Date
          </label>
          <input
            type="date"
            id="dateFrom"
            defaultValue={searchParams.get("dateFrom") || ""}
            onChange={(e) =>
              updateFilters({ dateFrom: e.target.value || undefined })
            }
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        {/* Date To */}
        <div>
          <label
            htmlFor="dateTo"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            To Date
          </label>
          <input
            type="date"
            id="dateTo"
            defaultValue={searchParams.get("dateTo") || ""}
            onChange={(e) =>
              updateFilters({ dateTo: e.target.value || undefined })
            }
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        {/* Search */}
        <div className="lg:col-span-2">
          <label
            htmlFor="search"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Search (name or employer)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              id="search"
              placeholder="Search visitors..."
              defaultValue={searchParams.get("search") || ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  updateFilters({ search: e.currentTarget.value || undefined });
                }
              }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            <button
              type="button"
              onClick={() => {
                const input = document.getElementById(
                  "search",
                ) as HTMLInputElement;
                updateFilters({ search: input.value || undefined });
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Clear Filters */}
      <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
        <button
          type="button"
          onClick={() => router.push("/admin/history")}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Clear all filters
        </button>
      </div>
    </div>
  );
}
