import Link from "next/link";
import type { ReactNode } from "react";

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
      <header className="relative z-10 border-b border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)]">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 py-5 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
            Live Visitor Sign-In
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl">{brand}</h1>
          <p className="text-sm text-secondary">{subtitle}</p>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:px-6">{children}</main>

      <footer className="relative z-10 px-4 pb-6 pt-2 text-center text-sm text-secondary sm:px-6">
        <div className="mx-auto max-w-4xl rounded-[var(--radius-card)] border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-4 py-3">
          {footerText ? (
            <p>{footerText}</p>
          ) : (
            <p className="flex flex-wrap items-center justify-center gap-2">
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
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
