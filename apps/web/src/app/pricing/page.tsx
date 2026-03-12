import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { TierPresentation } from "@/lib/plans/tier-presentation";
import { TIER_PRESENTATION } from "@/lib/plans/tier-presentation";
import { cn } from "@/lib/utils";
import { STANDARD_FLOOR_PRICE_CENTS } from "@/lib/plans/pricing";

export const metadata: Metadata = {
  title: "Pricing | InductLite",
  description:
    "Compare Standard, Plus, and Pro pricing for InductLite site induction and visitor workflows.",
};

const PLAN_DETAILS = TIER_PRESENTATION.filter(
  (item): item is TierPresentation & { key: "STANDARD" | "PLUS" | "PRO"; priceCents: number } =>
    item.key !== "ADD_ONS" && Number.isFinite(item.priceCents),
);

const ADD_ONS_TIER = TIER_PRESENTATION.find((item) => item.key === "ADD_ONS");

const COMPARISON_ROWS: Array<{
  feature: string;
  standard: string;
  plus: string;
  pro: string;
}> = [
  {
    feature: "QR/public link sign-in",
    standard: "Included",
    plus: "Included",
    pro: "Included",
  },
  {
    feature: "Digital induction builder",
    standard: "Included",
    plus: "Included",
    pro: "Included",
  },
  {
    feature: "Emergency roll-call",
    standard: "Included",
    plus: "Included",
    pro: "Included",
  },
  {
    feature: "Safety forms (SWMS/JSA/RAMS/toolbox/fatigue)",
    standard: "Included",
    plus: "Included",
    pro: "Included",
  },
  {
    feature: "Quiz scoring + retries",
    standard: "Optional by entitlement",
    plus: "Included",
    pro: "Included",
  },
  {
    feature: "Media-first content blocks",
    standard: "Optional by entitlement",
    plus: "Included",
    pro: "Included",
  },
  {
    feature: "LMS connector",
    standard: "Not included",
    plus: "Not included",
    pro: "Included",
  },
];

const TRUST_SIGNALS = [
  "Clean border system with low-contrast separators for scan clarity",
  "Subtle trust shadows to separate layers without visual noise",
  "Mobile-first progressive disclosure for dense plan comparison data",
];

function formatPlanPrice(cents: number): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function getValueBadgeVariant(value: string): "default" | "success" | "warning" {
  if (value === "Included") {
    return "success";
  }
  if (value.startsWith("Optional")) {
    return "warning";
  }
  return "default";
}

export default function PricingPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden px-4 py-8 sm:px-6 sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-cyan-300/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="glass-card flex flex-wrap items-center justify-between gap-3 px-4 py-3 reveal-up">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
              Pricing
            </p>
            <p className="text-sm text-secondary">Standard, Plus, Pro, and optional add-ons</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Home
            </Link>
            <Link href="/compare" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Compare
            </Link>
            <Link href="/demo" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Book Demo
            </Link>
            <Link href="/register" className={buttonVariants({ size: "sm" })}>
              Start Workspace
            </Link>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-12">
          <Card tone="glass" className="lg:col-span-8 reveal-up">
            <CardHeader>
              <Badge variant="primary" className="w-fit">
                Strategic Minimalism
              </Badge>
              <CardTitle className="mt-2">Pricing built for predictable, per-site control</CardTitle>
              <CardDescription className="max-w-3xl">
                Plan bands are optimized for predictable monthly spend. Standard supports removable
                features so cost-sensitive clients can reduce price without losing core safety workflows.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-2 border-t border-[color:var(--border-soft)] pt-4 text-xs text-muted sm:flex-row sm:items-center">
              <span>Standard minimum floor: {formatPlanPrice(STANDARD_FLOOR_PRICE_CENTS)} / site / month</span>
            </CardFooter>
          </Card>
          <Card tone="default" className="lg:col-span-4 reveal-up-delay">
            <CardHeader>
              <CardTitle className="text-base">Trust Signals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-secondary">
              {TRUST_SIGNALS.map((signal) => (
                <p key={signal} className="rounded-lg border border-surface-soft bg-surface-soft px-3 py-2">
                  {signal}
                </p>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="bento-grid">
          {PLAN_DETAILS.map((item) => (
            <Card
              key={item.key}
              tone={item.key === "PRO" ? "elevated" : "default"}
              interactive
              className={cn(item.key === "PRO" ? "ring-strong" : "ring-soft", "reveal-up")}
            >
              <CardHeader>
                <Badge variant={item.badgeTone} className="w-fit">
                  {item.label}
                </Badge>
                <CardTitle className="mt-2 text-3xl font-black">
                  {formatPlanPrice(item.priceCents)}
                </CardTitle>
                <CardDescription>Per site / month</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-secondary">{item.subtitle}</p>
                <ul className="space-y-2 text-sm text-secondary">
                  {item.highlights.map((point) => (
                    <li key={point} className="rounded-lg border border-surface-soft bg-surface-soft px-3 py-2">
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Link href="/register" className={cn(buttonVariants(), "w-full")}>
                  Choose {item.label}
                </Link>
              </CardFooter>
            </Card>
          ))}
        </section>

        <section className="surface-panel px-4 py-5 sm:px-6">
          <h2 className="text-2xl font-bold">Plan Comparison</h2>
          <p className="mt-2 text-sm text-secondary">
            Fast view of what is included by default in each band
          </p>

          <div className="progressive-disclosure-mobile mt-4 space-y-2">
            {COMPARISON_ROWS.map((row) => (
              <details key={row.feature} className="rounded-xl border border-surface-soft bg-surface-soft px-3 py-2">
                <summary className="cursor-pointer text-sm font-semibold text-[color:var(--text-primary)]">
                  {row.feature}
                </summary>
                <div className="mt-2 grid gap-2 text-xs text-secondary">
                  <div className="flex items-center justify-between rounded-md bg-surface-soft px-2 py-1.5">
                    <span>Standard</span>
                    <Badge variant={getValueBadgeVariant(row.standard)}>{row.standard}</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-surface-soft px-2 py-1.5">
                    <span>Plus</span>
                    <Badge variant={getValueBadgeVariant(row.plus)}>{row.plus}</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-surface-soft px-2 py-1.5">
                    <span>Pro</span>
                    <Badge variant={getValueBadgeVariant(row.pro)}>{row.pro}</Badge>
                  </div>
                </div>
              </details>
            ))}
          </div>

          <div className="progressive-disclosure-desktop mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
              <thead className="bg-[color:var(--bg-surface-strong)]">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Feature
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Standard
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Plus
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.feature}>
                    <td className="px-3 py-2 text-sm font-semibold text-[color:var(--text-primary)]">
                      {row.feature}
                    </td>
                    <td className="px-3 py-2 text-sm text-secondary">{row.standard}</td>
                    <td className="px-3 py-2 text-sm text-secondary">{row.plus}</td>
                    <td className="px-3 py-2 text-sm text-secondary">{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Card tone="default">
          <CardHeader>
            <CardTitle>Optional Add-ons</CardTitle>
            <CardDescription>
              Keep high-cost capabilities optional so the base product stays competitively priced
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {ADD_ONS_TIER?.highlights.map((item) => (
              <article key={item} className="glass-card rounded-xl p-4">
                <p className="text-sm text-secondary">{item}</p>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card tone="elevated" className="text-center">
          <CardHeader>
            <CardTitle>Need a custom rollout quote?</CardTitle>
            <CardDescription>
              We can map your required features into Standard, Plus, Pro, and add-ons per site
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex-col justify-center gap-3 sm:flex-row">
            <Link href="/demo" className={cn(buttonVariants(), "sm:min-w-[220px]")}>
              Book a Demo
            </Link>
            <a
              href="mailto:sales@inductlite.nz?subject=Pricing%20Quote%20Request"
              className={cn(buttonVariants({ variant: "secondary" }), "sm:min-w-[220px]")}
            >
              Email Sales
            </a>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
