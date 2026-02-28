"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type CommandPaletteItem = {
  id: string;
  href: string;
  title: string;
  description: string;
  keywords?: string[];
  contexts?: string[];
};

interface AdminCommandPaletteProps {
  commands: CommandPaletteItem[];
}

const USAGE_STORAGE_KEY = "inductlite:command-palette-usage:v1";

function readUsageMap(): Record<string, number> {
  if (typeof window === "undefined") return {};

  const raw = window.localStorage.getItem(USAGE_STORAGE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    window.localStorage.removeItem(USAGE_STORAGE_KEY);
    return {};
  }
}

function writeUsageMap(next: Record<string, number>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(next));
}

function getContextKey(pathname: string): string {
  if (pathname.startsWith("/admin/sites")) return "sites";
  if (pathname.startsWith("/admin/contractors")) return "contractors";
  if (pathname.startsWith("/admin/live-register")) return "live";
  if (pathname.startsWith("/admin/templates")) return "templates";
  if (pathname.startsWith("/admin/history")) return "history";
  if (pathname.startsWith("/admin/exports")) return "exports";
  if (pathname.startsWith("/admin/escalations")) return "escalations";
  if (pathname.startsWith("/admin/settings")) return "settings";
  if (pathname.startsWith("/admin/users")) return "users";
  return "dashboard";
}

export function AdminCommandPalette({ commands }: AdminCommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "/admin/dashboard";
  const contextKey = getContextKey(pathname);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [usageMap, setUsageMap] = useState<Record<string, number>>({});
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl K");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUsageMap(readUsageMap());
    const isMac = navigator.userAgent.includes("Mac");
    setShortcutLabel(isMac ? "Cmd K" : "Ctrl K");
  }, []);

  const rankedCommands = useMemo(() => {
    const search = query.trim().toLowerCase();
    const tokens = search.length === 0 ? [] : search.split(/\s+/);

    return commands
      .map((command) => {
        const haystack = [
          command.title,
          command.description,
          ...(command.keywords ?? []),
        ]
          .join(" ")
          .toLowerCase();

        if (tokens.length > 0 && !tokens.every((token) => haystack.includes(token))) {
          return null;
        }

        let score = 1;

        if (command.contexts?.includes(contextKey)) {
          score += 3;
        }

        if (command.href === pathname) {
          score -= 1;
        }

        score += Math.min((usageMap[command.id] ?? 0) * 0.15, 3);

        if (search.length > 0 && command.title.toLowerCase().startsWith(search)) {
          score += 2;
        }

        return { command, score };
      })
      .filter((item): item is { command: CommandPaletteItem; score: number } => Boolean(item))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.command.title.localeCompare(b.command.title);
      })
      .slice(0, 10);
  }, [commands, contextKey, pathname, query, usageMap]);

  const suggestions = useMemo(
    () => rankedCommands.slice(0, 3).map((item) => item.command),
    [rankedCommands],
  );

  const executeCommand = useCallback((command: CommandPaletteItem) => {
    const nextUsageMap = {
      ...usageMap,
      [command.id]: (usageMap[command.id] ?? 0) + 1,
    };
    setUsageMap(nextUsageMap);
    writeUsageMap(nextUsageMap);
    setOpen(false);
    setQuery("");
    router.push(command.href);
  }, [router, usageMap]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      if (!open) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, rankedCommands.length - 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (event.key === "Enter") {
        const match = rankedCommands[selectedIndex];
        if (!match) return;
        event.preventDefault();
        executeCommand(match.command);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [executeCommand, open, rankedCommands, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    setSelectedIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-white/35 bg-[color:var(--bg-surface)] px-3 py-2 text-sm font-medium text-[color:var(--text-primary)] shadow-soft hover:-translate-y-0.5 hover:border-white/60 hover:bg-[color:var(--bg-surface-strong)]"
        aria-label="Open command palette"
      >
        <span>Quick Actions</span>
        <kbd className="rounded-md border border-white/40 bg-white/55 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">
          {shortcutLabel}
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100]">
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-slate-950/45 backdrop-blur-sm"
            aria-label="Close command palette"
            onClick={() => setOpen(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="relative mx-auto mt-10 w-[min(92vw,46rem)] overflow-hidden rounded-2xl border border-white/30 bg-[color:var(--bg-surface-strong)] shadow-float"
          >
            <div className="border-b border-white/20 p-4">
              <label htmlFor="command-search" className="sr-only">
                Search command
              </label>
              <input
                id="command-search"
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Type a command or page name..."
                className="input"
              />
              <p className="mt-2 text-xs text-muted">
                Press <span className="font-semibold">Enter</span> to run,{" "}
                <span className="font-semibold">Esc</span> to close.
              </p>
            </div>

            {query.length === 0 && suggestions.length > 0 && (
              <div className="border-b border-white/15 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Suggested
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestions.map((command) => (
                    <button
                      key={`suggestion-${command.id}`}
                      type="button"
                      onClick={() => executeCommand(command)}
                      className="rounded-full border border-white/35 bg-[color:var(--bg-surface)] px-3 py-1 text-xs font-medium text-[color:var(--text-primary)] hover:border-white/60 hover:bg-[color:var(--bg-surface-strong)]"
                    >
                      {command.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <ul role="listbox" aria-label="Commands" className="max-h-[56vh] overflow-y-auto p-2">
              {rankedCommands.length === 0 && (
                <li className="rounded-xl px-3 py-4 text-sm text-muted">No matching commands.</li>
              )}

              {rankedCommands.map((item, index) => (
                <li key={item.command.id} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedIndex === index}
                    onClick={() => executeCommand(item.command)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`kinetic-hover flex w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left ${
                      selectedIndex === index
                        ? "bg-indigo-500/18 text-[color:var(--text-primary)]"
                        : "text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface)]"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="kinetic-title block text-sm font-bold">{item.command.title}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {item.command.description}
                      </span>
                    </span>
                    <span className="rounded-md border border-white/30 bg-[color:var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                      Go
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
