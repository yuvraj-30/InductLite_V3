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
import { findActivePreRegistrationInviteByToken } from "@/lib/repository/pre-registration.repository";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";

interface PublicSignInPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ invite?: string }>;
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

function renderErrorCard(message: string, retryHref: string) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="surface-panel-strong w-full max-w-md p-8 text-center">
        <div className="mb-4 text-red-600 dark:text-red-200">
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
        <h1 className="kinetic-title mb-2 text-3xl font-black">Unable to Load</h1>
        <Alert variant="error">{message}</Alert>
        <p className="mt-3 text-sm text-secondary">
          If you are offline, reconnect to mobile data or Wi-Fi, then retry.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <a href={retryHref} className="btn-primary px-4 text-sm">
            Retry
          </a>
          <a href="/" className="btn-secondary px-4 text-sm">
            Back to Home
          </a>
        </div>
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
  searchParams,
}: PublicSignInPageProps) {
  const { slug } = await params;
  const { invite } = await searchParams;
  const retryHref = `/s/${encodeURIComponent(slug)}`;

  const rateLimit = await checkPublicSlugRateLimit(slug);
  if (!rateLimit.success) {
    return renderErrorCard("Too many requests. Please try again later.", retryHref);
  }

  const result = await getCachedSiteConfig(slug);

  // Rate limited or error
  if (!result.success) {
    return renderErrorCard(result.error.message, retryHref);
  }

  // Site not found
  if ("notFound" in result.data) {
    notFound();
  }

  const { site, template } = result.data;
  let prefillInvite:
    | {
        token: string;
        visitorName: string;
        visitorPhone: string;
        visitorEmail?: string | null;
        employerName?: string | null;
        visitorType: "CONTRACTOR" | "VISITOR" | "EMPLOYEE" | "DELIVERY";
        roleOnSite?: string | null;
      }
    | undefined;

  if (invite?.trim()) {
    try {
      await assertCompanyFeatureEnabled(
        site.companyId,
        "PREREG_INVITES",
        site.id,
      );

      const inviteRecord = await findActivePreRegistrationInviteByToken(
        site.companyId,
        site.id,
        invite.trim(),
      );

      if (inviteRecord) {
        prefillInvite = {
          token: invite.trim(),
          visitorName: inviteRecord.visitor_name,
          visitorPhone: inviteRecord.visitor_phone,
          visitorEmail: inviteRecord.visitor_email,
          employerName: inviteRecord.employer_name,
          visitorType: inviteRecord.visitor_type,
          roleOnSite: inviteRecord.role_on_site,
        };
      }
    } catch (error) {
      if (!(error instanceof EntitlementDeniedError)) {
        throw error;
      }
    }
  }

  return (
    <PublicShell brand={site.companyName} subtitle={site.name}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-md focus:bg-[color:var(--bg-surface)] focus:p-4 focus:text-accent"
      >
        Skip to content
      </a>
      <section id="main-content">
        <SignInFlow
          slug={slug}
          site={site}
          template={template}
          prefillInvite={prefillInvite}
        />
      </section>
    </PublicShell>
  );
}
