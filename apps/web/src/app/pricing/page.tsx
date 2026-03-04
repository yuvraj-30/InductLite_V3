import type { Metadata } from "next";
import Link from "next/link";
import { PLAN_BASE_PRICE_CENTS, STANDARD_FLOOR_PRICE_CENTS } from "@/lib/plans/pricing";

export const metadata: Metadata = {
  title: "Pricing | InductLite",
  description:
    "Compare Standard, Plus, and Pro pricing for InductLite site induction and visitor workflows.",
};

type PublicPlan = "STANDARD" | "PLUS" | "PRO";

const PLAN_DETAILS: Array<{
  plan: PublicPlan;
  label: string;
  subtitle: string;
  highlights: string[];
}> = [
  {
    plan: "STANDARD",
    label: "Standard",
    subtitle: "Core operations for small-to-medium site teams.",
    highlights: [
      "QR sign-in, inductions, and live register",
      "Emergency roll-call and evidence exports",
      "Pre-registration and reminder workflows",
      "Removable feature credits for cost-sensitive sites",
    ],
  },
  {
    plan: "PLUS",
    label: "Plus",
    subtitle: "Deeper workflow control for higher-volume operations.",
    highlights: [
      "Everything in Standard",
      "Quiz scoring and retry control",
      "Media-first induction blocks",
      "Stronger policy depth for field workflows",
    ],
  },
  {
    plan: "PRO",
    label: "Pro",
    subtitle: "Best for multi-site environments and advanced operations.",
    highlights: [
      "Everything in Plus",
      "LMS connector capability",
      "Advanced analytics surfaces",
      "Built for larger governance and compliance needs",
    ],
  },
];

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

const ADD_ONS = [
  {
    title: "SMS workflows",
    detail:
      "Use for high-urgency messaging. Keep this as an add-on to control recurring send costs.",
  },
  {
    title: "Hardware access integration",
    detail:
      "Gate/turnstile decision integration for sites that require physical access control.",
  },
  {
    title: "Premium implementation support",
    detail:
      "Structured rollout help, template migration, and operational enablement for larger teams.",
  },
];

function formatPlanPrice(cents: number): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function PricingPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden px-4 py-8 sm:px-6 sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="surface-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
              Pricing
            </p>
            <p className="text-sm text-secondary">Standard, Plus, Pro, and optional add-ons.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="btn-secondary">
              Home
            </Link>
            <Link href="/compare" className="btn-secondary">
              Compare
            </Link>
            <Link href="/demo" className="btn-secondary">
              Book Demo
            </Link>
            <Link href="/register" className="btn-primary">
              Start Workspace
            </Link>
          </div>
        </header>

        <section className="surface-panel-strong p-6 sm:p-8">
          <h1 className="kinetic-title text-4xl font-black sm:text-5xl">Pricing built for per-site control.</h1>
          <p className="mt-3 max-w-3xl text-sm text-secondary sm:text-base">
            Plan bands are optimized for predictable monthly spend. Standard supports removable
            features so cost-sensitive clients can reduce price without losing core safety workflows.
          </p>
          <p className="mt-3 text-xs text-muted">
            Standard minimum floor: {formatPlanPrice(STANDARD_FLOOR_PRICE_CENTS)} / site / month.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {PLAN_DETAILS.map((item) => (
            <article key={item.plan} className="surface-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                {item.label}
              </p>
              <p className="mt-2 text-3xl font-black">
                {formatPlanPrice(PLAN_BASE_PRICE_CENTS[item.plan])}
              </p>
              <p className="text-xs text-secondary">Per site / month</p>
              <p className="mt-3 text-sm text-secondary">{item.subtitle}</p>
              <ul className="mt-4 space-y-2 text-sm text-secondary">
                {item.highlights.map((point) => (
                  <li key={point} className="rounded-lg border border-white/25 bg-white/35 px-3 py-2">
                    {point}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="btn-primary mt-4 w-full">
                Choose {item.label}
              </Link>
            </article>
          ))}
        </section>

        <section className="surface-panel overflow-x-auto px-4 py-5 sm:px-6">
          <h2 className="text-2xl font-bold">Plan Comparison</h2>
          <p className="mt-2 text-sm text-secondary">
            Fast view of what is included by default in each band.
          </p>
          <table className="mt-4 min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
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
            <tbody className="divide-y divide-gray-200 bg-white">
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.feature}>
                  <td className="px-3 py-2 text-sm font-semibold text-gray-900">{row.feature}</td>
                  <td className="px-3 py-2 text-sm text-secondary">{row.standard}</td>
                  <td className="px-3 py-2 text-sm text-secondary">{row.plus}</td>
                  <td className="px-3 py-2 text-sm text-secondary">{row.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="surface-panel px-4 py-5 sm:px-6">
          <h2 className="text-2xl font-bold">Optional Add-ons</h2>
          <p className="mt-2 text-sm text-secondary">
            Keep high-cost capabilities optional so the base product stays competitively priced.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {ADD_ONS.map((addon) => (
              <article key={addon.title} className="rounded-xl border border-white/25 bg-white/35 p-4">
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">{addon.title}</p>
                <p className="mt-2 text-xs text-secondary">{addon.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="surface-panel-strong p-6 text-center">
          <h2 className="text-2xl font-bold">Need a custom rollout quote?</h2>
          <p className="mt-2 text-sm text-secondary">
            We can map your required features into Standard, Plus, Pro, and add-ons per site.
          </p>
          <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/demo" className="btn-primary sm:min-w-[220px]">
              Book a Demo
            </Link>
            <a
              href="mailto:sales@inductlite.nz?subject=Pricing%20Quote%20Request"
              className="btn-secondary sm:min-w-[220px]"
            >
              Email Sales
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
