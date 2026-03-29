import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeSwitcher } from "./theme-switcher";

interface PublicShellProps {
  brand: string;
  subtitle: string;
  children: ReactNode;
  footerText?: string;
  className?: string;
}

export function PublicShell({
  brand,
  subtitle,
  children,
  footerText,
  className = "",
}: PublicShellProps) {
  return (
    <div className={`relative min-h-screen overflow-hidden ${className}`.trim()}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-indigo-500/14 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)]">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                Live visitor sign-in
              </p>
              <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{brand}</h1>
              <p className="mt-2 max-w-2xl text-sm text-secondary">{subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start">
              <Link
                href="/login"
                className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-2 text-xs font-semibold text-secondary hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)] sm:text-sm"
              >
                Operator login
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">
              QR entry and induction
            </span>
            <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">
              Mobile-ready clearance
            </span>
            <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">
              Live register visibility
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-6">
        {children}
      </main>

      <footer className="relative z-10 px-4 pb-6 pt-2 text-center text-sm text-secondary sm:px-6">
        <div className="mx-auto max-w-4xl rounded-[var(--radius-card)] border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-4 py-3">
          {footerText ? (
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
              <span>{footerText}</span>
              <span aria-hidden="true">|</span>
              <ThemeSwitcher showLabel={false} className="text-[11px]" />
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
              <span>Powered by</span>
              <Link href="/" className="font-semibold text-accent hover:underline">
                InductLite
              </Link>
              <span aria-hidden="true">|</span>
              <Link href="/terms" className="text-accent hover:underline">
                Terms
              </Link>
              <span aria-hidden="true">|</span>
              <Link href="/privacy" className="text-accent hover:underline">
                Privacy
              </Link>
              <span aria-hidden="true">|</span>
              <a href="mailto:support@inductlite.nz" className="text-accent hover:underline">
                Support
              </a>
              <span aria-hidden="true">|</span>
              <ThemeSwitcher showLabel={false} className="text-[11px]" />
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
