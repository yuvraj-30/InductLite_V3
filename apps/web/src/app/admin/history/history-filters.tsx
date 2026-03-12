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
    <div className="table-toolbar mb-6">
      <div className="table-toolbar-heading">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
          Filter Sign-In History
        </h2>
      </div>
      <div className="table-toolbar-grid">
        {/* Site Filter */}
        <div>
          <label htmlFor="site" className="label mb-1">
            Site
          </label>
          <select
            id="site"
            defaultValue={searchParams.get("site") || ""}
            onChange={(e) =>
              updateFilters({ site: e.target.value || undefined })
            }
            className="input"
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
          <label htmlFor="status" className="label mb-1">
            Status
          </label>
          <select
            id="status"
            defaultValue={searchParams.get("status") || "all"}
            onChange={(e) =>
              updateFilters({ status: e.target.value || undefined })
            }
            className="input"
          >
            <option value="all">All</option>
            <option value="on_site">Currently On Site</option>
            <option value="signed_out">Signed Out</option>
          </select>
        </div>

        {/* Visitor Type Filter */}
        <div>
          <label htmlFor="visitorType" className="label mb-1">
            Visitor Type
          </label>
          <select
            id="visitorType"
            defaultValue={searchParams.get("visitorType") || ""}
            onChange={(e) =>
              updateFilters({ visitorType: e.target.value || undefined })
            }
            className="input"
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
          <label htmlFor="employer" className="label mb-1">
            Employer
          </label>
          <select
            id="employer"
            defaultValue={searchParams.get("employer") || ""}
            onChange={(e) =>
              updateFilters({ employer: e.target.value || undefined })
            }
            className="input"
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
          <label htmlFor="dateFrom" className="label mb-1">
            From Date
          </label>
          <input
            type="date"
            id="dateFrom"
            defaultValue={searchParams.get("dateFrom") || ""}
            onChange={(e) =>
              updateFilters({ dateFrom: e.target.value || undefined })
            }
            className="input"
          />
        </div>

        {/* Date To */}
        <div>
          <label htmlFor="dateTo" className="label mb-1">
            To Date
          </label>
          <input
            type="date"
            id="dateTo"
            defaultValue={searchParams.get("dateTo") || ""}
            onChange={(e) =>
              updateFilters({ dateTo: e.target.value || undefined })
            }
            className="input"
          />
        </div>

        {/* Search */}
        <div className="md:col-span-2">
          <label htmlFor="search" className="label mb-1">
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
              className="input"
            />
            <button
              type="button"
              onClick={() => {
                const input = document.getElementById(
                  "search",
                ) as HTMLInputElement;
                updateFilters({ search: input.value || undefined });
              }}
              className="btn-primary"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Clear Filters */}
      <div className="table-toolbar-footer flex justify-end">
        <button
          type="button"
          onClick={() => router.push("/admin/history")}
          className="text-sm font-medium text-secondary hover:text-[color:var(--text-primary)]"
        >
          Clear all filters
        </button>
      </div>
    </div>
  );
}
