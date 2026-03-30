/**
 * Auth Layout
 *
 * Shared layout for public authentication pages.
 */

import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PublicSignalCard } from "@/components/ui/public-signal-card";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";

export const metadata: Metadata = {
  title: "InductLite - Login",
  description: "Sign in to your InductLite account",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 sm:py-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-indigo-500/14 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary hover:text-accent"
            >
              InductLite
            </Link>
            <p className="mt-2 max-w-md text-sm text-secondary">
              Site induction, visitor clearance, and live operational records
              for NZ construction teams.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/demo" className="btn-secondary px-3 py-2 text-sm">
              Book demo
            </Link>
          </div>
        </header>

        <main className="flex flex-1 items-center py-6 sm:py-8">
          <div className="grid w-full gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(400px,0.88fr)] lg:items-center">
            <section className="surface-panel-strong order-2 p-6 lg:order-1 lg:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
                Operator access
              </p>
              <h1 className="kinetic-title mt-3 max-w-[12ch] text-4xl font-black leading-[0.98]">
                Sign in to the same workflow your sites already trust.
              </h1>
              <p className="mt-4 max-w-2xl text-sm text-secondary sm:text-base">
                Keep sign-in, inductions, live registers, and compliance
                records connected from the first QR scan through to audit-ready
                evidence.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <PublicSignalCard
                  eyebrow="Controlled access"
                  title="Tenant-scoped operator sign-in by default."
                />
                <PublicSignalCard
                  eyebrow="Live operations"
                  title="Move from login into active sites, registers, and approvals."
                />
                <PublicSignalCard
                  eyebrow="Evidence ready"
                  title="Compliance history stays attached to the same workflow."
                />
              </div>
            </section>

            <section className="surface-panel-strong order-1 p-5 sm:p-6 lg:order-2 lg:p-8">
              {children}
            </section>
          </div>
        </main>

        <footer className="pb-2 text-center text-xs text-muted sm:text-sm">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
            <span>&copy; {new Date().getFullYear()} InductLite. All rights reserved.</span>
            <span aria-hidden="true">|</span>
            <ThemeSwitcher showLabel={false} className="text-[11px]" />
            <span aria-hidden="true">|</span>
            <Link href="/terms" className="hover:text-accent hover:underline">
              Terms
            </Link>
            <span aria-hidden="true">|</span>
            <Link href="/privacy" className="hover:text-accent hover:underline">
              Privacy
            </Link>
            <span aria-hidden="true">|</span>
            <a
              href="mailto:support@inductlite.nz"
              className="hover:text-accent hover:underline"
            >
              Support
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
