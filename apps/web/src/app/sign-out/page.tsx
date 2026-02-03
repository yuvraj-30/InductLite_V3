/**
 * Self-Service Sign-Out Page
 *
 * Allows visitors to sign out using their token.
 * Token is passed in URL query parameter.
 */

import { Metadata } from "next";
import Link from "next/link";
import { SignOutForm } from "./components/SignOutForm";

export const metadata: Metadata = {
  title: "Sign Out | InductLite",
  description: "Sign out from your site visit",
};

interface SignOutPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function SignOutPage({ searchParams }: SignOutPageProps) {
  const { token } = await searchParams;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-bold">InductLite</h1>
          <p className="text-blue-100 text-sm">Visitor Sign-Out</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        <SignOutForm initialToken={token || ""} />
      </main>

      {/* Footer */}
      <footer className="text-center text-sm text-gray-500 py-4">
        <p>
          Powered by{" "}
          <Link href="/" className="text-blue-600 hover:underline">
            InductLite
          </Link>
        </p>
      </footer>
    </div>
  );
}
