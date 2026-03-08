import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  findCompanyComplianceSettings,
  findCompanySsoSettings,
} from "@/lib/repository/company.repository";
import ComplianceSettingsForm from "./compliance-settings-form";
import { buildCompanyInvoicePreview } from "@/lib/plans";
import BillingSyncPanel from "./billing-sync-panel";
import SsoSettingsPanel from "./sso-settings-panel";
import { parseCompanySsoConfig } from "@/lib/identity";

export const metadata = {
  title: "Settings | InductLite",
};

function formatNzd(cents: number): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(cents / 100);
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
  const settings = await findCompanyComplianceSettings(context.companyId);
  const ssoRecord = await findCompanySsoSettings(context.companyId);
  const ssoConfig = parseCompanySsoConfig(ssoRecord?.sso_config ?? null);
  const billingPreview = await buildCompanyInvoicePreview(context.companyId);
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
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <h1 className="text-lg font-semibold text-red-800">Settings unavailable</h1>
          <p className="mt-1 text-sm text-red-700">
            Unable to load company compliance settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Compliance Settings</h1>
        <p className="mt-1 text-gray-600">
          Configure retention windows and legal hold controls for compliance
          evidence.
        </p>
      </div>

      <section className="mb-6 rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Monthly Plan Billing Preview
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Estimated monthly subscription based on active sites and current
          feature entitlements.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-gray-600">Base total</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {formatNzd(billingPreview.baseTotalCents)}
            </p>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-gray-600">Credits</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              -{formatNzd(billingPreview.creditTotalCents)}
            </p>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-gray-600">Estimated total</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {formatNzd(billingPreview.finalTotalCents)}
            </p>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Active sites: {billingPreview.activeSiteCount}. Generated at{" "}
          {billingPreview.generatedAt.toLocaleString("en-NZ")}.
        </p>

        {billingPreview.siteInvoices.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Site
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Plan
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Base
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Credits
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {billingPreview.siteInvoices.map((siteInvoice) => (
                  <tr key={siteInvoice.siteId}>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {siteInvoice.siteName}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">{siteInvoice.plan}</td>
                    <td className="px-4 py-2 text-right text-sm text-gray-700">
                      {formatNzd(siteInvoice.basePriceCents)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-700">
                      -{formatNzd(siteInvoice.creditAppliedCents)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">
                      {formatNzd(siteInvoice.finalPriceCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">
            No active sites are currently billable.
          </p>
        )}
      </section>

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
