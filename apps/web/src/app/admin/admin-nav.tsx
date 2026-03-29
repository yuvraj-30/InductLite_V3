"use client";

import Link from "next/link";
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

interface AdminNavAccountContext {
  companyName: string;
  userName: string;
  userRole: string;
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
  accountContext?: AdminNavAccountContext;
}

export function AdminNav({
  sections,
  mobileShellEnabled = false,
  mobileQuickSwitchItems,
  accountContext,
}: AdminNavProps) {
  const pathname = usePathname() ?? "";
  const [query, setQuery] = useState("");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
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
    setMobileDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileDrawerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileDrawerOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileDrawerOpen]);

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

  const navList = filteredSections.length === 0 ? (
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
  );

  const navContent = (
    <div className="px-2 py-2 md:max-h-none md:overflow-visible md:p-3">
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

      {quickSwitchItems.length > 0 ? (
        <div className="mb-3 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-2 md:hidden">
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
      ) : null}

      {navList}
    </div>
  );

  return (
    <>
      {mobileShellEnabled ? (
        <div className="space-y-2 px-3 py-3 md:hidden">
          <div className="admin-mobile-nav-bar">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                Current Route
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-[color:var(--text-primary)]">
                {activeContext?.item.label ?? "Dashboard"}
              </p>
              <p className="truncate text-xs text-secondary">
                {activeContext?.sectionTitle ?? "Operations"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="btn-secondary min-h-[40px] shrink-0 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]"
            >
              Navigation
            </button>
          </div>
        </div>
      ) : null}

      {mobileShellEnabled ? (
        <div className="hidden max-h-[40vh] overflow-y-auto md:block md:max-h-none md:overflow-visible">
          {navContent}
        </div>
      ) : (
        <div className="max-h-[40vh] overflow-y-auto md:max-h-none md:overflow-visible">
          {navContent}
        </div>
      )}

      {mobileShellEnabled && mobileDrawerOpen ? (
        <div
          className="modal-overlay items-stretch justify-end p-0 md:hidden"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setMobileDrawerOpen(false);
            }
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="admin-mobile-drawer-panel"
          >
            <div className="admin-mobile-drawer-header">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Admin navigation
                </p>
                <p className="mt-1 truncate text-base font-semibold text-[color:var(--text-primary)]">
                  {accountContext?.companyName ?? "InductLite"}
                </p>
                <p className="truncate text-xs text-secondary">
                  {activeContext?.item.label ?? "Dashboard"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="btn-secondary min-h-[38px] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]"
              >
                Close
              </button>
            </div>

            {accountContext ? (
              <div className="border-b border-[color:var(--border-soft)] px-4 py-3">
                <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-3">
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                    {accountContext.userName}
                  </p>
                  <p className="mt-1 text-xs text-secondary">
                    {accountContext.userRole}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto">{navContent}</div>

            <div className="admin-mobile-drawer-footer space-y-3">
              <Link
                href="/change-password"
                className="btn-secondary w-full justify-center"
              >
                Password
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="btn-secondary w-full justify-center border-[color:var(--accent-danger)] text-[color:var(--accent-danger)] hover:bg-red-100/70 dark:hover:bg-red-500/20"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
