import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TierPresentation } from "@/lib/plans/tier-presentation";
import { TIER_PRESENTATION } from "@/lib/plans/tier-presentation";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "InductLite vs NZ Competitors | Feature Comparison",
  description:
    "Compare InductLite with NZ site induction and visitor management competitors across pricing, workflows, and compliance capabilities.",
};

const COMPARISON_ROWS: Array<{
  feature: string;
  inductLite: string;
  competitors: string;
}> = [
  {
    feature: "QR sign-in and sign-out flow",
    inductLite: "Yes",
    competitors: "Common baseline across major NZ tools",
  },
  {
    feature: "Media-first inductions (PDF/video/image/text)",
    inductLite: "Yes",
    competitors: "Available on leading induction platforms",
  },
  {
    feature: "Emergency roll-call and muster export",
    inductLite: "Yes",
    competitors: "Usually available in safety-focused platforms",
  },
  {
    feature: "Pre-registration invite workflow",
    inductLite: "Yes",
    competitors: "Available in visitor-focused products",
  },
  {
    feature: "Pricing bands with removable Standard features",
    inductLite: "Yes",
    competitors: "Less commonly exposed as modular per-site controls",
  },
  {
    feature: "Permit-to-Work / Control-of-Work module",
    inductLite: "Yes",
    competitors: "Available in some higher-depth safety suites",
  },
  {
    feature: "SWMS/JSA/RAMS/toolbox/fatigue digital forms",
    inductLite: "Yes",
    competitors: "Common in construction-focused safety suites",
  },
  {
    feature: "Named physical access connectors",
    inductLite: "Yes (HID Origo, Brivo, Gallagher, LenelS2, Genetec)",
    competitors: "Usually limited to selected enterprise tiers",
  },
  {
    feature: "ID watchlists and random security checks",
    inductLite: "Yes",
    competitors: "Available in some enterprise visitor products",
  },
  {
    feature: "Teams/Slack approval loops",
    inductLite: "Yes",
    competitors: "Available in selected competitors",
  },
  {
    feature: "Mobile auto check-in/out automation (API + PWA workflows)",
    inductLite: "Yes (store-ready native wrappers; publish after credential setup)",
    competitors: "Available in some mobile-first products",
  },
];

const COMPETITOR_NOTES = [
  {
    name: "1Breadcrumb",
    summary:
      "Strong permit and contractor workflow messaging; positioned for construction operations depth.",
  },
  {
    name: "Site App Pro",
    summary:
      "Broad compliance workflow coverage with strong NZ construction positioning and app-led messaging.",
  },
  {
    name: "SwipedOn",
    summary:
      "Visitor management strength with polished onboarding flows and collaboration integrations.",
  },
  {
    name: "Sine",
    summary:
      "Security-focused visitor workflows including identity and emergency communication options.",
  },
  {
    name: "HazardCo / ThinkSafe",
    summary:
      "Safety/compliance-led offering with templates, advisory framing, and operational support emphasis.",
  },
];

const WHY_INDUCTLITE = [
  "Single workflow from sign-in to evidence export without enterprise bloat.",
  "Tenant-scoped architecture and strong guardrails for safer operations at scale.",
  "Flexible Standard/Plus/Pro packaging with add-ons for cost control.",
  "Built for NZ operational expectations and field realities.",
];

const PLAN_TIERS = TIER_PRESENTATION.filter(
  (item): item is TierPresentation & { key: "STANDARD" | "PLUS" | "PRO"; priceCents: number } =>
    item.key !== "ADD_ONS" && Number.isFinite(item.priceCents),
);

const ADD_ONS_TIER = TIER_PRESENTATION.find((item) => item.key === "ADD_ONS");

function formatPlanPrice(cents: number): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function ComparePage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden px-4 py-8 sm:px-6 sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="glass-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
              Compare
            </p>
            <p className="text-sm text-secondary">InductLite versus common NZ alternatives.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Home
            </Link>
            <Link href="/pricing" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Pricing
            </Link>
            <Link href="/demo" className={buttonVariants({ size: "sm" })}>
              Book Demo
            </Link>
          </div>
        </header>

        <section className="surface-panel-strong p-6 sm:p-8">
          <h1 className="kinetic-title text-4xl font-black sm:text-5xl">
            InductLite vs NZ competitor feature sets
          </h1>
          <p className="mt-3 max-w-4xl text-sm text-secondary sm:text-base">
            Use this comparison to shortlist solutions quickly. It reflects public
            competitor positioning and current InductLite scope.
          </p>
          <p className="mt-2 text-xs text-muted">Snapshot date: March 11, 2026.</p>
        </section>

        <section className="bento-grid">
          {PLAN_TIERS.map((plan) => (
            <Card key={plan.key} tone={plan.key === "PRO" ? "elevated" : "default"} interactive>
              <CardHeader>
                <Badge variant={plan.badgeTone} className="w-fit">
                  {plan.label}
                </Badge>
                <CardTitle className="mt-2 text-3xl font-black">{formatPlanPrice(plan.priceCents)}</CardTitle>
                <CardDescription>Per site / month</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-secondary">{plan.audience}</p>
                <ul className="space-y-2 text-xs text-secondary">
                  {plan.highlights.slice(0, 3).map((item) => (
                    <li key={item} className="rounded-lg border border-surface-soft bg-surface-soft px-2 py-1.5">
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
          {ADD_ONS_TIER ? (
            <Card tone="glass">
              <CardHeader>
                <Badge variant={ADD_ONS_TIER.badgeTone} className="w-fit">
                  {ADD_ONS_TIER.label}
                </Badge>
                <CardTitle className="mt-2 text-xl">{ADD_ONS_TIER.subtitle}</CardTitle>
                <CardDescription>{ADD_ONS_TIER.audience}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-secondary">
                {ADD_ONS_TIER.highlights.slice(0, 3).map((item) => (
                  <p key={item} className="rounded-lg border border-surface-soft bg-surface-soft px-2 py-1.5">
                    {item}
                  </p>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </section>

        <section className="surface-panel overflow-x-auto px-4 py-5 sm:px-6">
          <h2 className="text-2xl font-bold">Feature Comparison Snapshot</h2>
          <table className="mt-4 min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Feature
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  InductLite
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Competitor signal
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.feature}>
                  <td className="px-3 py-2 text-sm font-semibold text-[color:var(--text-primary)]">
                    {row.feature}
                  </td>
                  <td className="px-3 py-2 text-sm text-secondary">{row.inductLite}</td>
                  <td className="px-3 py-2 text-sm text-secondary">{row.competitors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="surface-panel p-5">
            <h2 className="text-xl font-bold">Competitor Positioning Notes</h2>
            <div className="mt-4 space-y-3">
              {COMPETITOR_NOTES.map((entry) => (
                <div key={entry.name} className="rounded-xl border border-surface-soft bg-surface-soft p-3">
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">{entry.name}</p>
                  <p className="mt-1 text-xs text-secondary">{entry.summary}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="surface-panel p-5">
            <h2 className="text-xl font-bold">Why teams choose InductLite</h2>
            <ul className="mt-4 space-y-2 text-sm text-secondary">
              {WHY_INDUCTLITE.map((item) => (
                <li key={item} className="rounded-xl border border-surface-soft bg-surface-soft px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link href="/demo" className={cn(buttonVariants(), "sm:min-w-[180px]")}>
                Book Demo
              </Link>
              <Link
                href="/pricing"
                className={cn(buttonVariants({ variant: "secondary" }), "sm:min-w-[180px]")}
              >
                View Pricing
              </Link>
            </div>
          </article>
        </section>

        <section className="surface-panel px-4 py-4 text-xs text-muted sm:px-6">
          This page is for decision support and reflects public marketing signals
          rather than a legal/contractual claim set for competitors.
        </section>
      </div>
    </main>
  );
}
