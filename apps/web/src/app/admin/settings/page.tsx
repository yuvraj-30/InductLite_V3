import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  findCompanyComplianceSettings,
  findCompanySsoSettings,
} from "@/lib/repository/company.repository";
import ComplianceSettingsForm from "./compliance-settings-form";
import {
  COMPANY_TIERS,
  buildCompanyInvoicePreview,
  getCompanyTierPresentation,
  getTierPresentation,
} from "@/lib/plans";
import BillingSyncPanel from "./billing-sync-panel";
import SsoSettingsPanel from "./sso-settings-panel";
import { parseCompanySsoConfig } from "@/lib/identity";

export const metadata = {
  title: "Settings | InductLite",
};

interface BillingPreviewSectionProps {
  companyId: string;
  addOnsTier: ReturnType<typeof getTierPresentation>;
  tierCards: ReturnType<typeof getCompanyTierPresentation>[];
}

function formatNzd(cents: number): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(cents / 100);
}

function BillingPreviewSectionFallback() {
  return (
    <section className="surface-panel p-4">
      <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
        Monthly Plan Billing Preview
      </h2>
      <p className="mt-1 text-sm text-secondary">
        Estimated monthly subscription based on active sites and current
        feature entitlements.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)]"
          />
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)]"
          />
        ))}
      </div>
    </section>
  );
}

async function BillingPreviewSection({
  companyId,
  addOnsTier,
  tierCards,
}: BillingPreviewSectionProps) {
  const billingPreview = await buildCompanyInvoicePreview(companyId);
  const planCounts = COMPANY_TIERS.reduce(
    (acc, tier) => {
      acc[tier] = 0;
      return acc;
    },
    {} as Record<(typeof COMPANY_TIERS)[number], number>,
  );

  for (const siteInvoice of billingPreview.siteInvoices) {
    planCounts[siteInvoice.plan] += 1;
  }

  return (
    <section className="surface-panel p-4">
      <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
        Monthly Plan Billing Preview
      </h2>
      <p className="mt-1 text-sm text-secondary">
        Estimated monthly subscription based on active sites and current
        feature entitlements.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3">
          <p className="text-xs uppercase tracking-[0.08em] text-secondary">Base total</p>
          <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">
            {formatNzd(billingPreview.baseTotalCents)}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3">
          <p className="text-xs uppercase tracking-[0.08em] text-secondary">Credits</p>
          <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">
            -{formatNzd(billingPreview.creditTotalCents)}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3">
          <p className="text-xs uppercase tracking-[0.08em] text-secondary">Estimated total</p>
          <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">
            {formatNzd(billingPreview.finalTotalCents)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {tierCards.map((tier) => (
          <article
            key={tier.key}
            className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={tier.badgeTone}>{tier.label}</Badge>
              <span className="text-xs text-secondary">
                {planCounts[tier.key]} site{planCounts[tier.key] === 1 ? "" : "s"}
              </span>
            </div>
            <p className="mt-2 text-xs text-secondary">{tier.subtitle}</p>
          </article>
        ))}
        <article className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3">
          <Badge variant={addOnsTier.badgeTone}>{addOnsTier.label}</Badge>
          <p className="mt-2 text-xs text-secondary">
            {addOnsTier.subtitle} Enable by entitlement where operationally required.
          </p>
        </article>
      </div>

      <p className="mt-3 text-xs text-secondary">
        Active sites: {billingPreview.activeSiteCount}. Generated at{" "}
        {billingPreview.generatedAt.toLocaleString("en-NZ")}.
      </p>

      {billingPreview.siteInvoices.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-[color:var(--border-soft)]">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Site
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Plan
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Base
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Credits
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {billingPreview.siteInvoices.map((siteInvoice) => {
                const tier = getCompanyTierPresentation(siteInvoice.plan);
                return (
                  <tr
                    key={siteInvoice.siteId}
                    className="hover:bg-[color:var(--bg-surface-strong)]"
                  >
                    <td className="px-4 py-2 text-sm text-secondary">
                      {siteInvoice.siteName}
                    </td>
                    <td className="px-4 py-2 text-sm text-secondary">
                      <Badge variant={tier.badgeTone}>{tier.label}</Badge>
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-secondary">
                      {formatNzd(siteInvoice.basePriceCents)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-secondary">
                      -{formatNzd(siteInvoice.creditAppliedCents)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-semibold text-[color:var(--text-primary)]">
                      {formatNzd(siteInvoice.finalPriceCents)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-secondary">
          No active sites are currently billable.
        </p>
      )}
    </section>
  );
}

export default async function AdminSettingsPage() {
  const guard = await checkPermissionReadOnly("settings:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") {
      redirect("/login");
    }
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const [settings, ssoRecord] = await Promise.all([
    findCompanyComplianceSettings(context.companyId),
    findCompanySsoSettings(context.companyId),
  ]);
  const ssoConfig = parseCompanySsoConfig(ssoRecord?.sso_config ?? null);
  const addOnsTier = getTierPresentation("ADD_ONS");
  const tierCards = COMPANY_TIERS.map((tier) => getCompanyTierPresentation(tier));
  const accountingSyncEndpointRaw =
    process.env.ACCOUNTING_SYNC_ENDPOINT_URL?.trim() ?? "";
  let accountingSyncEndpointHost: string | null = null;
  if (accountingSyncEndpointRaw) {
    try {
      accountingSyncEndpointHost = new URL(accountingSyncEndpointRaw).host;
    } catch {
      accountingSyncEndpointHost = null;
    }
  }

  if (!settings) {
    return (
      <div className="space-y-6 p-3 sm:p-4">
        <div className="surface-panel-strong p-5">
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Compliance Settings
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Configure retention windows and legal hold controls for compliance
            evidence.
          </p>
        </div>
        <div className="rounded-xl border border-red-400/45 bg-red-100/70 p-4 dark:bg-red-950/45">
          <h2 className="text-sm font-semibold text-red-950 dark:text-red-100">
            Settings unavailable
          </h2>
          <p className="mt-1 text-sm text-red-900 dark:text-red-200">
            Unable to load company compliance settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong p-5">
        <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
          Compliance Settings
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Configure retention windows and legal hold controls for compliance
          evidence.
        </p>
      </div>

      <Suspense fallback={<BillingPreviewSectionFallback />}>
        <BillingPreviewSection
          companyId={context.companyId}
          addOnsTier={addOnsTier}
          tierCards={tierCards}
        />
      </Suspense>

      <SsoSettingsPanel
        initialConfig={{
          enabled: ssoConfig.enabled,
          provider: ssoConfig.provider,
          displayName: ssoConfig.displayName,
          issuerUrl: ssoConfig.issuerUrl,
          clientId: ssoConfig.clientId,
          scopes: ssoConfig.scopes,
          autoProvisionUsers: ssoConfig.autoProvisionUsers,
          defaultRole: ssoConfig.defaultRole,
          roleClaimPath: ssoConfig.roleClaimPath,
          roleMapping: ssoConfig.roleMapping,
          allowedEmailDomains: ssoConfig.allowedEmailDomains,
          directorySyncEnabled: ssoConfig.directorySync.enabled,
          partnerApiEnabled: ssoConfig.partnerApi.enabled,
          partnerApiScopes: ssoConfig.partnerApi.scopes,
          partnerApiMonthlyQuota: ssoConfig.partnerApi.monthlyQuota,
          hasClientSecret: Boolean(ssoConfig.clientSecretEncrypted),
          hasDirectorySyncToken: Boolean(ssoConfig.directorySync.tokenHash),
          hasPartnerApiToken: Boolean(ssoConfig.partnerApi.tokenHash),
        }}
      />

      <BillingSyncPanel endpointHost={accountingSyncEndpointHost} />

      <ComplianceSettingsForm initialSettings={settings} />
    </div>
  );
}
