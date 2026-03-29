import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { AdminSectionHeader } from "@/components/ui/admin-section-header";
import { checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  findCompanyComplianceSettings,
  findCompanySsoSettings,
} from "@/lib/repository/company.repository";
import ComplianceSettingsForm from "./compliance-settings-form";
import {
  COMPANY_TIERS,
  buildCompanyInvoiceSummary,
  type CompanyInvoiceSummary,
  getCompanyTierPresentation,
  getTierPresentation,
} from "@/lib/plans";
import BillingSyncPanel from "./billing-sync-panel";
import SsoSettingsPanel from "./sso-settings-panel";
import BillingPreviewDetailDisclosure from "./billing-preview-detail-disclosure";
import { parseCompanySsoConfig } from "@/lib/identity";

export const metadata = {
  title: "Settings | InductLite",
};

type ComplianceSettings = NonNullable<
  Awaited<ReturnType<typeof findCompanyComplianceSettings>>
>;
type ParsedCompanySsoConfig = ReturnType<typeof parseCompanySsoConfig>;
type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger";

interface SettingsOverviewCard {
  eyebrow: string;
  title: string;
  description: string;
  badgeLabel: string;
  badgeVariant: BadgeVariant;
  href: string;
  footerLabel: string;
}

interface BillingPlanSummaryRow {
  key: string;
  label: string;
  subtitle: string;
  badgeTone: BadgeVariant;
  siteCount: number;
}

type BillingPlanSummaryCounts = CompanyInvoiceSummary["planCounts"];

interface BillingTierCard {
  key: (typeof COMPANY_TIERS)[number];
  label: string;
  subtitle: string;
  badgeTone: BadgeVariant;
}

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

export function formatResidencySummary(
  settings: Pick<
    ComplianceSettings,
    "data_residency_region" | "data_residency_scope"
  >,
): string {
  const regionLabel =
    settings.data_residency_region === "NZ"
      ? "New Zealand"
      : settings.data_residency_region === "AU"
        ? "Australia"
        : settings.data_residency_region === "APAC"
          ? "APAC"
          : settings.data_residency_region === "GLOBAL"
            ? "Global"
            : null;

  const scopeLabel =
    settings.data_residency_scope === "PRIMARY_ONLY"
      ? "Primary only"
      : settings.data_residency_scope === "PRIMARY_AND_BACKUP"
        ? "Primary and backup"
        : settings.data_residency_scope === "PROCESSING_ONLY"
          ? "Processing only"
          : null;

  if (!regionLabel && !scopeLabel) {
    return "Not declared";
  }

  if (!regionLabel) {
    return scopeLabel!;
  }

  if (!scopeLabel) {
    return regionLabel;
  }

  return `${regionLabel} · ${scopeLabel}`;
}

function formatAttestationSummary(
  settings: Pick<
    ComplianceSettings,
    "data_residency_attested_at" | "data_residency_attested_by"
  >,
): string {
  if (!settings.data_residency_attested_at) {
    return "Residency posture not yet attested.";
  }

  const attestationTime =
    settings.data_residency_attested_at.toLocaleDateString("en-NZ");
  const actor = settings.data_residency_attested_by
    ? ` by ${settings.data_residency_attested_by}`
    : "";

  return `Last attested ${attestationTime}${actor}.`;
}

export function buildSettingsOverviewCards(input: {
  settings: ComplianceSettings;
  ssoConfig: ParsedCompanySsoConfig;
  endpointHost: string | null;
}): SettingsOverviewCard[] {
  const { settings, ssoConfig, endpointHost } = input;
  const providerLabel =
    ssoConfig.provider === "MICROSOFT_ENTRA"
      ? "Microsoft Entra ID"
      : "Generic OIDC";

  return [
    {
      eyebrow: "Compliance",
      title: settings.compliance_legal_hold
        ? "Legal hold is active"
        : "Retention controls are live",
      description: settings.compliance_legal_hold
        ? settings.compliance_legal_hold_reason?.trim() ||
          "Automated purges stay paused until legal hold is removed."
        : `Sign-ins ${settings.retention_days}d · Audit ${settings.audit_retention_days}d · Incidents ${settings.incident_retention_days}d.`,
      badgeLabel: settings.compliance_legal_hold
        ? "Hold enabled"
        : "Purge rules active",
      badgeVariant: settings.compliance_legal_hold ? "warning" : "success",
      href: "#compliance",
      footerLabel: "Review compliance controls",
    },
    {
      eyebrow: "Residency",
      title: formatResidencySummary(settings),
      description: formatAttestationSummary(settings),
      badgeLabel: settings.data_residency_region ? "Declared" : "Pending",
      badgeVariant: settings.data_residency_region ? "primary" : "default",
      href: "#compliance",
      footerLabel: "Update residency record",
    },
    {
      eyebrow: "Identity",
      title: ssoConfig.enabled ? "SSO enabled" : "Password sign-in only",
      description: `${providerLabel} · Auto-provision ${
        ssoConfig.autoProvisionUsers ? "on" : "off"
      } · Directory sync ${ssoConfig.directorySync.enabled ? "on" : "off"}.`,
      badgeLabel: ssoConfig.enabled ? "Enterprise login" : "Manual login",
      badgeVariant: ssoConfig.enabled ? "success" : "default",
      href: "#identity",
      footerLabel: "Manage access settings",
    },
    {
      eyebrow: "Accounting",
      title: endpointHost ?? "No sync endpoint configured",
      description: endpointHost
        ? "Billing preview can be pushed to accounting from the billing section."
        : "Billing preview remains available, but downstream sync is not configured yet.",
      badgeLabel: endpointHost ? "Sync ready" : "Not configured",
      badgeVariant: endpointHost ? "success" : "default",
      href: "#billing",
      footerLabel: "Open billing summary",
    },
  ];
}

export function buildBillingPlanSummaryRows(
  planCounts: BillingPlanSummaryCounts,
  tierCards: BillingTierCard[],
): BillingPlanSummaryRow[] {
  return tierCards.map((tier) => ({
    key: tier.key,
    label: tier.label,
    subtitle: tier.subtitle,
    badgeTone: tier.badgeTone,
    siteCount: planCounts[tier.key],
  }));
}

function SettingsOverviewCard({
  card,
}: {
  card: SettingsOverviewCard;
}) {
  return (
    <a
      href={card.href}
      className="surface-panel flex h-full flex-col gap-3 p-4 transition-colors hover:bg-[color:var(--bg-surface-strong)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {card.eyebrow}
          </p>
          <h2 className="mt-1 text-base font-semibold text-[color:var(--text-primary)]">
            {card.title}
          </h2>
        </div>
        <Badge variant={card.badgeVariant}>{card.badgeLabel}</Badge>
      </div>
      <p className="text-sm text-secondary">{card.description}</p>
      <span className="mt-auto text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary">
        {card.footerLabel}
      </span>
    </a>
  );
}

function BillingPreviewSectionFallback() {
  return (
    <section className="surface-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-3 w-28 animate-pulse rounded bg-[color:var(--bg-surface-strong)]" />
          <div className="h-6 w-44 animate-pulse rounded bg-[color:var(--bg-surface-strong)]" />
          <div className="h-4 w-64 animate-pulse rounded bg-[color:var(--bg-surface-strong)]" />
        </div>
        <div className="h-7 w-24 animate-pulse rounded-full bg-[color:var(--bg-surface-strong)]" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)]"
          />
        ))}
      </div>

      <div className="mt-4 h-32 animate-pulse rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)]" />
    </section>
  );
}

async function BillingPreviewSection({
  companyId,
  addOnsTier,
  tierCards,
}: BillingPreviewSectionProps) {
  const billingPreview = await buildCompanyInvoiceSummary(companyId);
  const planRows = buildBillingPlanSummaryRows(
    billingPreview.planCounts,
    tierCards,
  );

  return (
    <section className="surface-panel p-5">
      <AdminSectionHeader
        eyebrow="Billing snapshot"
        titleAs="h3"
        title="Current monthly plan estimate"
        description="Review active-site plan mix and accounting sync readiness without opening the full per-site breakdown first."
        action={
          <Badge variant="default">
            {billingPreview.activeSiteCount} active site
            {billingPreview.activeSiteCount === 1 ? "" : "s"}
          </Badge>
        }
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary">
            Estimated total
          </p>
          <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">
            {formatNzd(billingPreview.finalTotalCents)}
          </p>
        </article>
        <article className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary">
            Base charges
          </p>
          <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">
            {formatNzd(billingPreview.baseTotalCents)}
          </p>
        </article>
        <article className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary">
            Credits applied
          </p>
          <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">
            -{formatNzd(billingPreview.creditTotalCents)}
          </p>
        </article>
      </div>

      <div className="mt-4 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary">
            Plan mix
          </p>
          <p className="text-xs text-secondary">
            Generated {billingPreview.generatedAt.toLocaleString("en-NZ")}
          </p>
        </div>

        <div className="mt-3 space-y-2">
          {planRows.map((row) => (
            <div
              key={row.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={row.badgeTone}>{row.label}</Badge>
                  <span className="text-xs text-secondary">
                    {row.siteCount} site{row.siteCount === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-secondary">{row.subtitle}</p>
              </div>
              <span className="text-sm font-semibold text-[color:var(--text-primary)]">
                {row.siteCount}
              </span>
            </div>
          ))}

          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-2">
            <div className="min-w-0">
              <Badge variant={addOnsTier.badgeTone}>{addOnsTier.label}</Badge>
              <p className="mt-1 text-xs text-secondary">
                {addOnsTier.subtitle} Enable only where the site-level operating
                model requires it.
              </p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
              Entitlement based
            </span>
          </div>
        </div>
      </div>

      {billingPreview.activeSiteCount > 0 ? (
        <BillingPreviewDetailDisclosure
          initialSiteCount={billingPreview.activeSiteCount}
        />
      ) : (
        <p className="mt-4 text-sm text-secondary">
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
            Settings
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Manage compliance, identity access, and billing controls for your
            workspace.
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

  const overviewCards = buildSettingsOverviewCards({
    settings,
    ssoConfig,
    endpointHost: accountingSyncEndpointHost,
  });

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <section className="surface-panel-strong p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
                Settings
              </h1>
              <Badge variant="primary">Operator Control Surface</Badge>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-secondary">
              Manage compliance retention, identity access, and billing sync
              from a summary-first workspace that keeps heavy detail available
              without forcing it onto the first screen.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="#compliance"
              className="inline-flex min-h-[38px] items-center rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-secondary hover:bg-[color:var(--bg-surface-strong)]"
            >
              Compliance
            </a>
            <a
              href="#identity"
              className="inline-flex min-h-[38px] items-center rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-secondary hover:bg-[color:var(--bg-surface-strong)]"
            >
              Identity
            </a>
            <a
              href="#billing"
              className="inline-flex min-h-[38px] items-center rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-secondary hover:bg-[color:var(--bg-surface-strong)]"
            >
              Billing
            </a>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => (
          <SettingsOverviewCard key={card.eyebrow} card={card} />
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(20rem,0.82fr)] xl:items-start">
        <div className="space-y-6">
          <section className="space-y-3">
            <AdminSectionHeader
              id="compliance"
              eyebrow="Compliance and retention"
              title="Evidence lifecycle and legal controls"
              description="Set purge windows, manage legal hold, and record residency posture without digging through billing detail first."
            />
            <ComplianceSettingsForm initialSettings={settings} />
          </section>

          <section className="space-y-3">
            <AdminSectionHeader
              id="identity"
              eyebrow="Identity and access"
              title="Enterprise login and provisioning"
              description="Keep SSO, directory sync, partner API scopes, and key rotation in one focused access-management section."
            />
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
                hasDirectorySyncToken: Boolean(
                  ssoConfig.directorySync.tokenHash,
                ),
                hasPartnerApiToken: Boolean(ssoConfig.partnerApi.tokenHash),
              }}
            />
          </section>
        </div>

        <aside id="billing" className="space-y-6 xl:self-start">
          <AdminSectionHeader
            id="billing-overview"
            eyebrow="Billing and accounting"
            title="Plan preview and downstream sync"
            description="Keep the monthly estimate visible, move the invoice-style breakdown behind disclosure, and leave accounting actions close to the summary."
          />

          <Suspense fallback={<BillingPreviewSectionFallback />}>
            <BillingPreviewSection
              companyId={context.companyId}
              addOnsTier={addOnsTier}
              tierCards={tierCards}
            />
          </Suspense>

          <BillingSyncPanel endpointHost={accountingSyncEndpointHost} />
        </aside>
      </div>
    </div>
  );
}
