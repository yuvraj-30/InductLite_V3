/**
 * Auth Layout
 *
 * Minimal layout for authentication pages (login, logout, etc.)
 * No navigation or sidebar - just a centered auth form.
 */

import * as React from "react";
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
      <div className="relative z-10 w-full max-w-md space-y-8">
        <header className="text-center">
          <h1 className="text-4xl font-bold">InductLite</h1>
          <p className="mt-2 text-sm text-secondary">
            Site Induction & Contractor Management
          </p>
        </header>

        <main className="surface-panel-strong px-4 py-8 sm:px-10">
          {children}
        </main>

        <footer className="text-center text-xs text-muted">
          &copy; {new Date().getFullYear()} InductLite. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
