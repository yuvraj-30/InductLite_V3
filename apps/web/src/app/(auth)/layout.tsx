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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo/Brand */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">InductLite</h1>
          <p className="mt-2 text-sm text-gray-600">
            Site Induction & Contractor Management
          </p>
        </div>

        {/* Auth form container */}
        <div className="bg-white py-8 px-4 shadow-lg rounded-lg sm:px-10">
          {children}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} InductLite. All rights reserved.
        </p>
      </div>
    </div>
  );
}
