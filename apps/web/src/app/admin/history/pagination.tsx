"use client";

/**
 * Pagination Component
 */

import { useRouter, useSearchParams } from "next/navigation";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
  pageSize: number;
}

export function Pagination({
  currentPage,
  totalPages,
  total,
  pageSize,
}: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    router.push(`/admin/history?${params.toString()}`);
  };

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push("...");
      }

      // Show pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("...");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  if (totalPages <= 1) {
    return (
      <div className="text-sm text-secondary">
        Showing {total} {total === 1 ? "result" : "results"}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-secondary">
        Showing {startItem} to {endItem} of {total} results
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="btn-secondary min-h-[38px] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>

        {getPageNumbers().map((page, index) =>
          page === "..." ? (
            <span key={`ellipsis-${index}`} className="px-2 text-muted">
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => goToPage(page)}
              className={`min-h-[38px] rounded-md px-3 py-2 text-sm ${
                page === currentPage
                  ? "border border-indigo-400/45 bg-indigo-500/20 font-semibold text-indigo-900 dark:text-indigo-100"
                  : "btn-secondary"
              }`}
            >
              {page}
            </button>
          ),
        )}

        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="btn-secondary min-h-[38px] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
