/**
 * Public Sign-In Page
 *
 * Accessed via QR code using the site's public slug.
 * Rate-limited to prevent abuse.
 */

import { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { getSiteForSignIn } from "./actions";
import { SignInFlow } from "./components/SignInFlow";
import { PublicShell } from "@/components/ui/public-shell";
import { Alert } from "@/components/ui/alert";
import { checkPublicSlugRateLimit } from "@/lib/rate-limit";

interface PublicSignInPageProps {
  params: Promise<{ slug: string }>;
}

function getCachedSiteConfig(slug: string) {
  return unstable_cache(
    async () => getSiteForSignIn(slug, { skipRateLimit: true }),
    [`site-config-${slug}`],
    {
      tags: [`site-config-${slug}`],
      revalidate: 60,
    },
  )();
}

function renderErrorCard(message: string) {
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load</h1>
        <Alert variant="error">{message}</Alert>
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: PublicSignInPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getCachedSiteConfig(slug);

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

  const rateLimit = await checkPublicSlugRateLimit(slug);
  if (!rateLimit.success) {
    return renderErrorCard("Too many requests. Please try again later.");
  }

  const result = await getCachedSiteConfig(slug);

  // Rate limited or error
  if (!result.success) {
    return renderErrorCard(result.error.message);
  }

  // Site not found
  if ("notFound" in result.data) {
    notFound();
  }

  const { site, template } = result.data;

  return (
    <PublicShell brand={site.companyName} subtitle={site.name}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-blue-600"
      >
        Skip to content
      </a>
      <section id="main-content">
        <SignInFlow slug={slug} site={site} template={template} />
      </section>
    </PublicShell>
  );
}
