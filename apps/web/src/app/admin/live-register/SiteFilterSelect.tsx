"use client";

import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

const MAX_VISIBLE_SITE_OPTIONS = 14;

interface SiteOption {
  id: string;
  name: string;
  is_active: boolean;
}

interface SiteFilterSelectProps {
  sites: SiteOption[];
  siteFilter: string | undefined;
}

interface SiteFilterMatchResult {
  totalMatches: number;
  visibleSites: SiteOption[];
}

function normalizeSiteQuery(value: string): string {
  return value.trim().toLocaleLowerCase("en-NZ");
}

function compareSiteNames(left: SiteOption, right: SiteOption): number {
  return left.name.localeCompare(right.name, "en-NZ", {
    sensitivity: "base",
  });
}

export function buildLiveRegisterSiteFilterHref(
  pathname: string,
  currentSearch: string,
  siteId?: string,
): string {
  const params = new URLSearchParams(currentSearch);

  if (siteId) {
    params.set("site", siteId);
  } else {
    params.delete("site");
  }

  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

export function getLiveRegisterSiteMatches(
  sites: SiteOption[],
  query: string,
  selectedSiteId?: string,
  limit = MAX_VISIBLE_SITE_OPTIONS,
): SiteFilterMatchResult {
  const normalizedQuery = normalizeSiteQuery(query);

  const rankedSites = sites
    .filter((site) => {
      if (!normalizedQuery) {
        return true;
      }

      return normalizeSiteQuery(site.name).includes(normalizedQuery);
    })
    .sort((left, right) => {
      const leftIsSelected = left.id === selectedSiteId;
      const rightIsSelected = right.id === selectedSiteId;

      if (leftIsSelected !== rightIsSelected) {
        return leftIsSelected ? -1 : 1;
      }

      if (normalizedQuery) {
        const leftStartsWith = normalizeSiteQuery(left.name).startsWith(
          normalizedQuery,
        );
        const rightStartsWith = normalizeSiteQuery(right.name).startsWith(
          normalizedQuery,
        );

        if (leftStartsWith !== rightStartsWith) {
          return leftStartsWith ? -1 : 1;
        }
      }

      if (left.is_active !== right.is_active) {
        return left.is_active ? -1 : 1;
      }

      return compareSiteNames(left, right);
    });

  return {
    totalMatches: rankedSites.length,
    visibleSites: rankedSites.slice(0, limit),
  };
}

export function SiteFilterSelect({
  sites,
  siteFilter,
}: SiteFilterSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isPending, startTransition] = useTransition();

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === siteFilter) ?? null,
    [siteFilter, sites],
  );
  const filterQuery = isOpen && query === (selectedSite?.name ?? "") ? "" : query;
  const deferredQuery = useDeferredValue(filterQuery);
  const { totalMatches, visibleSites } = useMemo(
    () => getLiveRegisterSiteMatches(sites, deferredQuery, siteFilter),
    [deferredQuery, siteFilter, sites],
  );

  useEffect(() => {
    if (!isOpen) {
      setQuery(selectedSite?.name ?? "");
    }
  }, [isOpen, selectedSite?.name]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const selectedIndex = visibleSites.findIndex((site) => site.id === siteFilter);
    if (selectedIndex >= 0) {
      setHighlightedIndex(selectedIndex + 1);
      return;
    }

    setHighlightedIndex(deferredQuery && visibleSites.length > 0 ? 1 : 0);
  }, [deferredQuery, isOpen, siteFilter, visibleSites]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeCombobox = () => {
      setIsOpen(false);
      setQuery(selectedSite?.name ?? "");
    };

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeCombobox();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeCombobox();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [isOpen, selectedSite?.name]);

  const applySiteFilter = (nextSite?: SiteOption | null) => {
    const nextHref = buildLiveRegisterSiteFilterHref(
      pathname,
      searchParams.toString(),
      nextSite?.id,
    );

    setIsOpen(false);
    setQuery(nextSite?.name ?? "");

    startTransition(() => {
      router.replace(nextHref, { scroll: false });
    });
  };

  const optionCount = visibleSites.length + 1;
  const activeOptionId =
    isOpen && highlightedIndex > 0
      ? `${listboxId}-option-${visibleSites[highlightedIndex - 1]?.id ?? "unknown"}`
      : `${listboxId}-option-all`;

  return (
    <div ref={rootRef} className="w-full sm:max-w-xl">
      <label
        htmlFor="live-register-site-filter"
        className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
      >
        Site scope
      </label>

      <div className="relative">
        <div
          className={`flex min-h-[48px] items-center gap-2 rounded-xl border bg-[color:var(--bg-surface)] px-3 shadow-soft transition-colors ${
            isOpen
              ? "border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)]"
              : "border-[color:var(--border-soft)]"
          } ${isPending ? "opacity-80" : ""}`}
        >
          <svg
            className="h-4 w-4 flex-shrink-0 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>

          <input
            id="live-register-site-filter"
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-activedescendant={isOpen ? activeOptionId : undefined}
            aria-autocomplete="list"
            aria-label="Search and filter live register by site"
            value={query}
            placeholder="Search sites or leave blank for all sites"
            className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--text-primary)] outline-none placeholder:text-muted"
            onFocus={(event) => {
              setIsOpen(true);
              if (event.currentTarget.value) {
                event.currentTarget.select();
              }
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              if (!isOpen) {
                setIsOpen(true);
              }
            }}
            onKeyDown={(event) => {
              switch (event.key) {
                case "ArrowDown":
                  event.preventDefault();
                  if (!isOpen) {
                    setIsOpen(true);
                    return;
                  }
                  setHighlightedIndex((prev) =>
                    prev >= optionCount - 1 ? 0 : prev + 1,
                  );
                  break;
                case "ArrowUp":
                  event.preventDefault();
                  if (!isOpen) {
                    setIsOpen(true);
                    return;
                  }
                  setHighlightedIndex((prev) =>
                    prev <= 0 ? optionCount - 1 : prev - 1,
                  );
                  break;
                case "Enter":
                  if (!isOpen) {
                    return;
                  }
                  event.preventDefault();
                  if (highlightedIndex === 0) {
                    applySiteFilter(null);
                    return;
                  }
                  applySiteFilter(visibleSites[highlightedIndex - 1] ?? null);
                  break;
                case "Escape":
                  if (!isOpen) {
                    return;
                  }
                  event.preventDefault();
                  setIsOpen(false);
                  setQuery(selectedSite?.name ?? "");
                  break;
                default:
                  break;
              }
            }}
          />

          {(query || selectedSite) && (
            <button
              type="button"
              onClick={() => {
                if (siteFilter) {
                  applySiteFilter(null);
                  return;
                }

                setQuery("");
                setIsOpen(true);
                inputRef.current?.focus();
              }}
              className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary hover:bg-[color:var(--bg-surface-strong)]"
            >
              Clear
            </button>
          )}
        </div>

        {isOpen && (
          <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] shadow-[0_18px_48px_rgba(15,23,42,0.18)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--border-soft)] px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                {totalMatches} matching site{totalMatches === 1 ? "" : "s"}
              </p>
              <span className="text-xs text-secondary">
                {selectedSite
                  ? `Current: ${selectedSite.name}`
                  : "Showing all sites"}
              </span>
            </div>

            <ul
              id={listboxId}
              role="listbox"
              aria-label="Live register sites"
              className="max-h-72 overflow-y-auto p-2"
            >
              <li role="none">
                <button
                  id={`${listboxId}-option-all`}
                  type="button"
                  role="option"
                  aria-selected={!siteFilter}
                  onMouseEnter={() => setHighlightedIndex(0)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applySiteFilter(null)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left ${
                    highlightedIndex === 0
                      ? "bg-indigo-500/15 text-[color:var(--text-primary)]"
                      : "text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-strong)]"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      All sites
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      Show everyone currently on site across the company.
                    </span>
                  </span>
                  {!siteFilter ? (
                    <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-secondary">
                      Selected
                    </span>
                  ) : null}
                </button>
              </li>

              {visibleSites.length === 0 ? (
                <li
                  className="rounded-xl px-3 py-4 text-sm text-muted"
                  role="none"
                >
                  No sites match this search.
                </li>
              ) : (
                visibleSites.map((site, index) => {
                  const optionIndex = index + 1;
                  const isSelected = site.id === siteFilter;
                  const isHighlighted = highlightedIndex === optionIndex;

                  return (
                    <li key={site.id} role="none">
                      <button
                        id={`${listboxId}-option-${site.id}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() => setHighlightedIndex(optionIndex)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => applySiteFilter(site)}
                        className={`mt-1 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left ${
                          isHighlighted
                            ? "bg-indigo-500/15 text-[color:var(--text-primary)]"
                            : "text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-strong)]"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">
                            {site.name}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted">
                            {site.is_active ? "Active site" : "Inactive site"}
                          </span>
                        </span>
                        <span className="flex flex-shrink-0 items-center gap-2">
                          {!site.is_active ? (
                            <span className="rounded-full border border-amber-400/35 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-900 dark:text-amber-100">
                              Inactive
                            </span>
                          ) : null}
                          {isSelected ? (
                            <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-secondary">
                              Selected
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-secondary">
        <span>Search {sites.length} site{sites.length === 1 ? "" : "s"} quickly.</span>
        <span className="text-muted">|</span>
        <span aria-live="polite">
          {selectedSite
            ? `Scoped to ${selectedSite.name}`
            : "Showing all live register records"}
          {isPending ? " | Updating..." : ""}
        </span>
      </div>
    </div>
  );
}
