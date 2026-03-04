import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { checkSitePermissionReadOnly } from "@/lib/auth";
import { findSiteById } from "@/lib/repository/site.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { parseWebhookConfig } from "@/lib/webhook/config";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { WebhookSettingsForm } from "./webhook-settings-form";

interface SiteWebhookPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Site Webhooks | InductLite",
};

export default async function SiteWebhookPage({ params }: SiteWebhookPageProps) {
  const { id: siteId } = await params;

  const guard = await checkSitePermissionReadOnly("site:manage", siteId);
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const site = await findSiteById(context.companyId, siteId);
  if (!site) {
    notFound();
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "WEBHOOKS_OUTBOUND", siteId);
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Webhook Settings</h1>
              <p className="mt-1 text-gray-600">
                {site.name}: configure outbound webhook endpoints for induction
                completion events.
              </p>
            </div>
            <Link
              href={`/admin/sites/${siteId}`}
              className="inline-flex min-h-[40px] items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Back to Site
            </Link>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold text-amber-900">
              Feature not enabled for this site plan
            </h2>
            <p className="mt-1 text-sm text-amber-800">
              Webhook integrations are disabled by entitlements (CONTROL_ID:
              PLAN-ENTITLEMENT-001).
            </p>
          </div>
        </div>
      );
    }

    throw error;
  }

  const config = parseWebhookConfig(site.webhooks);
  const hasDefaultSigningSecret =
    (process.env.WEBHOOK_SIGNING_SECRET?.trim().length ?? 0) >= 16;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhook Settings</h1>
          <p className="mt-1 text-gray-600">
            {site.name}: configure outbound webhook endpoints for induction
            completion events.
          </p>
        </div>
        <Link
          href={`/admin/sites/${siteId}`}
          className="inline-flex min-h-[40px] items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Back to Site
        </Link>
      </div>

      <section className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-blue-900">
          Event Coverage
        </h2>
        <p className="mt-2 text-sm text-blue-900">
          This site currently publishes one event type:
          <code className="mx-1 rounded bg-white px-1 py-0.5 text-xs text-blue-900">
            induction.completed
          </code>
          for successful sign-ins.
        </p>
      </section>

      <WebhookSettingsForm
        siteId={siteId}
        initialUrls={config.endpoints.map((endpoint) => endpoint.url)}
        hasSiteSigningSecret={Boolean(config.signingSecret)}
        hasDefaultSigningSecret={hasDefaultSigningSecret}
        signingSecretUpdatedAt={config.signingSecretUpdatedAt}
      />
    </div>
  );
}
