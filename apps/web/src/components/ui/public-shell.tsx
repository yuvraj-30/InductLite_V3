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
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 -top-24 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-white/30 bg-white/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 py-5 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
            Live Visitor Sign-In
          </p>
          <h1 className="kinetic-title text-2xl font-black sm:text-3xl">{brand}</h1>
          <p className="text-sm text-secondary">{subtitle}</p>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:px-6">{children}</main>

      <footer className="relative z-10 px-4 pb-6 pt-2 text-center text-sm text-secondary sm:px-6">
        <div className="mx-auto max-w-4xl rounded-[var(--radius-card)] border border-white/35 bg-white/45 px-4 py-3 backdrop-blur-xl">
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
