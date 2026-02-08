/**
 * Public Sign-In Page
 *
 * Accessed via QR code using the site's public slug.
 * Rate-limited to prevent abuse.
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSiteForSignIn } from "./actions";
import { SignInFlow } from "./components/SignInFlow";

interface PublicSignInPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PublicSignInPageProps): Promise<Metadata> {
  const { slug } = await params;
  // Skip rate-limit checks when generating metadata to avoid double-counting the same
  // request that will also call getSiteForSignIn during render. The render path will
  // still enforce rate limiting.
  const result = await getSiteForSignIn(slug, { skipRateLimit: true });

  if (!result.success || "notFound" in result.data) {
    return {
      title: "Site Not Found | InductLite",
    };
  }

  return {
    title: `Sign In - ${result.data.site.name} | InductLite`,
    description: `Visitor sign-in for ${result.data.site.name}`,
  };
}

export default async function PublicSignInPage({
  params,
}: PublicSignInPageProps) {
  const { slug } = await params;
  const result = await getSiteForSignIn(slug);

  // Rate limited or error
  if (!result.success) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-red-500 mb-4">
            <svg
              className="mx-auto h-16 w-16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Unable to Load
          </h1>
          <p className="text-gray-600 mb-4">{result.error.message}</p>
        </div>
      </div>
    );
  }

  // Site not found
  if ("notFound" in result.data) {
    notFound();
  }

  const { site, template } = result.data;

  return (
    <div className="min-h-screen bg-gray-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-blue-600"
      >
        Skip to content
      </a>
      {/* Header */}
      <header className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-bold">{site.companyName}</h1>
          <p className="text-blue-50 text-sm">{site.name}</p>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="max-w-lg mx-auto px-4 py-6">
        <SignInFlow slug={slug} site={site} template={template} />
      </main>

      {/* Footer */}
      <footer className="text-center text-sm text-gray-600 py-4">
        <p>
          Powered by{" "}
          <Link href="/" className="text-blue-700 font-medium hover:underline">
            InductLite
          </Link>
        </p>
      </footer>
    </div>
  );
}
