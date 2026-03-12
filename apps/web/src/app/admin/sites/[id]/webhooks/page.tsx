import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { checkSitePermissionReadOnly } from "@/lib/auth";
import { findSiteById } from "@/lib/repository/site.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { parseWebhookConfig } from "@/lib/webhook/config";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { PageWarningState } from "@/components/ui/page-state";
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
        <div className="space-y-6 p-3 sm:p-4">
          <div className="surface-panel-strong flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">Webhook Settings</h1>
              <p className="mt-1 text-secondary">
                {site.name}: configure outbound webhook endpoints for induction
                completion events.
              </p>
            </div>
            <Link href={`/admin/sites/${siteId}`} className="btn-secondary w-full sm:w-auto">
              Back to Site
            </Link>
          </div>

          <div className="max-w-3xl">
            <PageWarningState
              title="Feature not enabled for this site plan."
              description="Webhook integrations are disabled by entitlements (CONTROL_ID: PLAN-ENTITLEMENT-001)."
            />
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
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">Webhook Settings</h1>
          <p className="mt-1 text-secondary">
            {site.name}: configure outbound webhook endpoints for induction
            completion events.
          </p>
        </div>
        <Link href={`/admin/sites/${siteId}`} className="btn-secondary w-full sm:w-auto">
          Back to Site
        </Link>
      </div>

      <section className="mb-6 rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-accent">
          Event Coverage
        </h2>
        <p className="mt-2 text-sm text-accent">
          This site currently publishes one event type:
          <code className="mx-1 rounded bg-[color:var(--bg-surface)] px-1 py-0.5 text-xs text-accent">
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
