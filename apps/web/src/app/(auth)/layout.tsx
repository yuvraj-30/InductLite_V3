/**
 * Auth Layout
 *
 * Minimal layout for authentication pages (login, logout, etc.)
 * No navigation or sidebar - just a centered auth form.
 */

import type { Metadata } from "next";

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-8 h-72 w-72 rounded-full bg-indigo-500/18 blur-3xl" />
        <div className="absolute right-0 top-20 h-72 w-72 rounded-full bg-cyan-400/18 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-8">
        <div className="text-center kinetic-hover">
          <h1 className="kinetic-title text-4xl font-black">InductLite</h1>
          <p className="mt-2 text-sm text-secondary">
            Site Induction & Contractor Management
          </p>
        </div>

        <div className="surface-panel-strong px-4 py-8 sm:px-10">
          {children}
        </div>

        <p className="text-center text-xs text-muted">
          &copy; {new Date().getFullYear()} InductLite. All rights reserved.
        </p>
      </div>
    </div>
  );
}
