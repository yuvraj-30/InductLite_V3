"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { reportUxEvent } from "@/lib/ux-events/client";
import { NavLink } from "./nav-link";

export interface AdminNavItem {
  href: string;
  label: string;
  exact?: boolean;
  isAccessible: boolean;
}

export interface AdminNavSection {
  title: string;
  items: AdminNavItem[];
}

export function isActivePath(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findActiveNavContext(
  sections: AdminNavSection[],
  pathname: string,
): { sectionTitle: string; item: AdminNavItem } | null {
  for (const section of sections) {
    for (const item of section.items) {
      if (!item.isAccessible) continue;
      if (isActivePath(pathname, item.href, item.exact ?? false)) {
        return { sectionTitle: section.title, item };
      }
    }
  }
  return null;
}

export function resolveMobileQuickSwitchItems(
  sections: AdminNavSection[],
  mobileQuickSwitchItems?: AdminNavItem[],
): AdminNavItem[] {
  if (mobileQuickSwitchItems && mobileQuickSwitchItems.length > 0) {
    return mobileQuickSwitchItems.filter((item) => item.isAccessible).slice(0, 5);
  }

  const flatItems = sections.flatMap((section) => section.items);
  return flatItems.filter((item) => item.isAccessible).slice(0, 5);
}

interface AdminNavProps {
  sections: AdminNavSection[];
  mobileShellEnabled?: boolean;
  mobileQuickSwitchItems?: AdminNavItem[];
}

export function AdminNav({
  sections,
  mobileShellEnabled = false,
  mobileQuickSwitchItems,
}: AdminNavProps) {
  const pathname = usePathname() ?? "";
  const [query, setQuery] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      sections.map((section, index) => [section.title, index === 0]),
    ),
  );
  const normalizedQuery = query.trim().toLowerCase();

  const filteredSections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) =>
            item.label.toLowerCase().includes(normalizedQuery),
          ),
        }))
        .filter((section) => section.items.length > 0),
    [normalizedQuery, sections],
  );
  const resultCount = useMemo(
    () =>
      filteredSections.reduce(
        (total, section) => total + section.items.length,
        0,
      ),
    [filteredSections],
  );
  const activeContext = useMemo(
    () => findActiveNavContext(sections, pathname),
    [pathname, sections],
  );
  const quickSwitchItems = useMemo(
    () => resolveMobileQuickSwitchItems(sections, mobileQuickSwitchItems),
    [mobileQuickSwitchItems, sections],
  );

  useEffect(() => {
    if (normalizedQuery.length === 0) return;

    const timeout = window.setTimeout(() => {
      reportUxEvent({
        event: "ux.admin.nav_search",
        path: pathname || "/admin",
        queryLength: normalizedQuery.length,
        resultCount,
        sectionCount: filteredSections.length,
      });
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [filteredSections.length, normalizedQuery, pathname, resultCount]);

  return (
    <div className="max-h-[40vh] overflow-y-auto px-2 py-2 md:max-h-none md:overflow-visible md:p-3">
      {mobileShellEnabled ? (
        <div className="mb-3 space-y-2 md:hidden">
          <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Current Route
            </p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">
              {activeContext?.item.label ?? "Dashboard"}
            </p>
            <p className="text-xs text-secondary">
              {activeContext?.sectionTitle ?? "Operations"}
            </p>
          </div>

          <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-2">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Quick Switch
            </p>
            <nav aria-label="Quick switch tasks" className="mt-2">
              <ul className="flex gap-2 overflow-x-auto pb-1">
                {quickSwitchItems.map((item) => (
                  <li key={`quick-${item.href}`} className="shrink-0">
                    <NavLink
                      href={item.href}
                      exact={item.exact}
                      variant="compact"
                      className="whitespace-nowrap"
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      ) : null}

      <div className="mb-3 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-2">
        <label
          htmlFor="admin-nav-search"
          className="mb-1 block px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
        >
          Find Page
        </label>
        <input
          id="admin-nav-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type to filter navigation..."
          className="input min-h-[40px]"
          autoComplete="off"
        />
        <p className="mt-2 px-1 text-xs text-muted">
          Need more pages? Use <span className="font-semibold">Cmd/Ctrl+K</span> for full command mode.
        </p>
      </div>

      {filteredSections.length === 0 ? (
        <p className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-2 text-sm text-muted">
          No pages match "{query}". Try a broader keyword.
        </p>
      ) : (
        <ul className="space-y-3">
          {filteredSections.map((section) => {
            const hasActiveItem = section.items.some(
              (item) =>
                item.isAccessible &&
                isActivePath(pathname, item.href, item.exact ?? false),
            );
            const isOpen =
              normalizedQuery.length > 0 ||
              hasActiveItem ||
              openSections[section.title] === true;

            return (
              <li key={section.title}>
                <details
                  className="group rounded-xl border border-transparent open:border-[color:var(--border-soft)] open:bg-[color:var(--bg-surface)]"
                  open={isOpen}
                  onToggle={(event) => {
                    if (normalizedQuery.length > 0 || hasActiveItem) return;
                    const nextOpen = event.currentTarget.open;
                    setOpenSections((current) => ({
                      ...current,
                      [section.title]: nextOpen,
                    }));
                  }}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted hover:bg-[color:var(--bg-surface-strong)]">
                    <span>{section.title}</span>
                    <span className="rounded-full border border-[color:var(--border-soft)] px-1.5 py-0.5 text-[10px]">
                      {section.items.length}
                    </span>
                  </summary>

                  <ul className="mt-1 space-y-1 px-2 pb-2">
                    {section.items.map((item) => (
                      <li key={item.href}>
                        {item.isAccessible ? (
                          <NavLink href={item.href} exact={item.exact}>
                            {item.label}
                          </NavLink>
                        ) : (
                          <span className="block cursor-not-allowed rounded-xl px-4 py-2.5 text-sm text-muted opacity-80">
                            {item.label}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
