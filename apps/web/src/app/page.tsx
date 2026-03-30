import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { PublicSignalCard } from "@/components/ui/public-signal-card";
import type { TierPresentation } from "@/lib/plans/tier-presentation";
import { TIER_PRESENTATION } from "@/lib/plans/tier-presentation";
import { cn } from "@/lib/utils";

// Nonce-based CSP requires runtime rendering so Next can attach per-request nonce
// attributes to inline hydration scripts.
export const dynamic = "force-dynamic";

const TRUST_BADGES = [
  "QR sign-in, induction, and clearance in one flow",
  "Live register and muster visibility without rework",
  "Tenant-scoped records ready for audits and client reviews",
];

const HERO_SIGNAL_POINTS = [
  "Move from arrival to active-on-site in one clear workflow.",
  "Handle contractors, visitors, drivers, and supervisors without separate tools.",
  "Keep evidence attached to the visit instead of rebuilding it later.",
];

const CAPABILITY_PILLARS = [
  {
    title: "Arrival to clearance",
    detail:
      "Serve the right induction, questions, signatures, and approvals from the same mobile-ready entry point.",
    highlights: [
      "QR and public-link sign-in",
      "Media-first induction delivery",
      "Exceptions and approvals stay attached",
    ],
  },
  {
    title: "Live site operations",
    detail:
      "Keep site teams current on who is on-site, what changed, and what needs attention right now.",
    highlights: [
      "Live register visibility",
      "Emergency roll-call readiness",
      "Supervisor control without slowing the gate",
    ],
  },
  {
    title: "Proof that holds up",
    detail:
      "Attendance, induction acceptance, signatures, and compliance evidence stay ready for clients and follow-up.",
    highlights: [
      "Audit-ready history",
      "Retention-aware records",
      "Exportable compliance evidence",
    ],
  },
];

const LAUNCH_STEPS = [
  {
    step: "01",
    title: "Set up the first site",
    detail:
      "Create one entry point, one induction template, and one operator-ready workflow.",
  },
  {
    step: "02",
    title: "Run the real sign-in path",
    detail:
      "Workers and visitors scan, review, sign, and become visible on site without a second admin loop.",
  },
  {
    step: "03",
    title: "Operate with proof",
    detail:
      "Live register, roll-call, and evidence exports update from the same sign-in trail.",
  },
];

const INTEGRATION_POINTS = [
  "Teams and Slack approval callbacks",
  "Outbound webhooks for external systems",
  "LMS connectors per site",
  "Email and SMS workflow support",
];

const PLAN_TIERS = TIER_PRESENTATION.filter(
  (item): item is TierPresentation & { key: "STANDARD" | "PLUS" | "PRO"; priceCents: number } =>
    item.key !== "ADD_ONS" && Number.isFinite(item.priceCents),
);

const ADD_ONS_TIER = TIER_PRESENTATION.find((item) => item.key === "ADD_ONS");
const ADD_ON_PREVIEW = ADD_ONS_TIER?.highlights.slice(0, 3) ?? [];
const INTEGRATION_PREVIEW = INTEGRATION_POINTS.slice(0, 3);

function formatPlanPrice(cents: number): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function HomePage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden px-4 py-6 sm:px-6 sm:py-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-20 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute right-0 top-1/4 h-80 w-80 rounded-full bg-indigo-500/18 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-6">
        <header className="surface-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
              InductLite
            </p>
            <p className="mt-1 text-xs text-muted">
              NZ site induction and visitor operations
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold sm:text-sm">
              <a href="#product" className="rounded-lg px-2 py-1 text-secondary hover:text-accent">
                Product
              </a>
              <a href="#pricing" className="rounded-lg px-2 py-1 text-secondary hover:text-accent">
                Pricing
              </a>
              <Link href="/demo" className="rounded-lg px-2 py-1 text-secondary hover:text-accent">
                Book demo
              </Link>
              <Link href="/login" className="btn-secondary px-3 py-2">
                Login
              </Link>
            </nav>
          </div>
        </header>

        <section className="surface-panel-strong overflow-hidden p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-start">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                Live induction for NZ construction teams
              </p>
              <h1 className="kinetic-title mt-3 max-w-[12ch] text-4xl font-black leading-[0.98] tracking-tight sm:text-5xl">
                Move arrival, induction, and clearance into one operator-ready flow.
              </h1>
              <p className="mt-4 max-w-2xl text-sm text-secondary sm:text-base">
                Keep QR sign-in, induction, live registers, and proof in one
                operating flow so teams can move people through the gate without
                rebuilding the record later.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="btn-primary w-full sm:w-auto sm:min-w-[220px]">
                  Start free
                </Link>
                <Link href="/demo" className="btn-secondary w-full sm:w-auto sm:min-w-[180px]">
                  Book demo
                </Link>
              </div>
            </div>

            <div className="surface-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                What teams feel first
              </p>
              <h2 className="mt-2 text-xl font-bold text-[color:var(--text-primary)]">
                Less admin between arrival and approval.
              </h2>
              <p className="mt-2 text-sm text-secondary">
                The clearest rollout starts with one visit record and keeps every
                later proof step attached to it.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-secondary">
                {HERO_SIGNAL_POINTS.map((item, index) => (
                  <li
                    key={item}
                    className="rounded-lg border border-surface-soft bg-surface-soft px-3 py-2"
                  >
                    <span className="mr-2 font-semibold text-[color:var(--text-primary)]">
                      {index + 1}.
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-xl border border-surface-soft bg-surface-soft p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  First rollout
                </p>
                <p className="mt-1 text-sm text-secondary">
                  Most teams start with one site, one QR entry point, and one
                  induction template.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="surface-panel px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
                Field-ready proof
              </p>
              <p className="mt-1 max-w-2xl text-sm text-secondary">
                Built for site teams that need sign-in, induction, live visibility,
                and evidence to stay in sync.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:max-w-[46rem] lg:flex-1">
              {TRUST_BADGES.map((badge) => (
                <p
                  key={badge}
                  className="rounded-lg border border-surface-soft bg-surface-soft px-3 py-2 text-xs font-semibold text-secondary"
                >
                  {badge}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section id="product" className="surface-panel px-5 py-6 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold">What site teams actually get</h2>
            <p className="mt-2 text-sm text-secondary">
              A single operating flow that starts at the gate and still holds up
              when someone asks for the evidence later.
            </p>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {CAPABILITY_PILLARS.map((pillar) => (
              <article key={pillar.title} className="bento-card">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                  Core capability
                </p>
                <h3 className="mt-2 text-xl font-bold">{pillar.title}</h3>
                <p className="mt-2 text-sm text-secondary">{pillar.detail}</p>
                <ul className="mt-4 space-y-2 text-sm text-secondary">
                  {pillar.highlights.map((item) => (
                    <li
                      key={item}
                      className="rounded-lg border border-surface-soft bg-surface-soft px-3 py-2"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="surface-panel px-5 py-6 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
            <div>
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold">Launch the first site in three moves</h2>
                <p className="mt-2 text-sm text-secondary">
                  Roll out the first site in a way site teams can actually follow.
                </p>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {LAUNCH_STEPS.map((step) => (
                  <PublicSignalCard
                    key={step.step}
                    eyebrow={`Step ${step.step}`}
                    title={step.title}
                    description={step.detail}
                  />
                ))}
              </div>
            </div>

            <article className="bento-card">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                Guided rollout
              </p>
              <h3 className="mt-2 text-xl font-bold">Bring us in when it helps the site move faster.</h3>
              <p className="mt-2 text-sm text-secondary">
                Start self-serve, then use a rollout walkthrough when you want
                to map paper or spreadsheet steps into a cleaner live workflow.
              </p>
              <div className="mt-4 rounded-xl border border-surface-soft bg-surface-soft p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  Typical first milestone
                </p>
                <p className="mt-2 text-sm text-secondary">
                  One live site, one working induction flow, and one export-ready
                  evidence trail.
                </p>
              </div>
              <Link
                href="/demo"
                className="mt-4 inline-flex text-sm font-semibold text-[color:var(--text-primary)] hover:text-accent hover:underline"
              >
                Book a rollout walkthrough
              </Link>
            </article>
          </div>
        </section>

        <section id="pricing" className="surface-panel-strong px-5 py-6 sm:px-6">
          <h2 className="text-2xl font-bold">Simple tier coverage</h2>
          <p className="mt-2 max-w-2xl text-sm text-secondary">
            Buyers should be able to judge fit quickly before they get into implementation detail.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {PLAN_TIERS.map((plan) => (
              <Card key={plan.key} tone={plan.key === "PRO" ? "elevated" : "default"} interactive>
                <CardHeader>
                  <Badge variant={plan.badgeTone} className="w-fit">
                    {plan.label}
                  </Badge>
                  <CardTitle className="mt-2 text-3xl font-black">
                    {formatPlanPrice(plan.priceCents)}
                  </CardTitle>
                  <CardDescription>Per site / month</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-secondary">{plan.subtitle}</p>
                  <ul className="space-y-2 text-xs text-secondary">
                    {plan.highlights.map((item) => (
                      <li
                        key={item}
                        className="rounded-lg border border-surface-soft bg-surface-soft px-2 py-1.5"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link href="/register" className={cn(buttonVariants(), "w-full")}>
                    Start {plan.label}
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)]">
            {ADD_ONS_TIER ? (
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={ADD_ONS_TIER.badgeTone}>{ADD_ONS_TIER.label}</Badge>
                  <p className="text-sm text-secondary">
                    Optional layers for sites that need more than the base operating flow.
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ADD_ON_PREVIEW.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-3 py-1.5 text-[11px] font-semibold text-secondary"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary">
                Connected when useful
              </p>
              <h3 className="mt-2 text-xl font-bold">
                Launch your first live site flow with one clear next step.
              </h3>
              <p className="mt-2 text-sm text-secondary">
                Start free, keep integrations optional, and book rollout help only when the first site is ready.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {INTEGRATION_PREVIEW.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-3 py-1.5 text-[11px] font-semibold text-secondary"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link href="/register" className="btn-primary sm:min-w-[180px]">
                  Start free
                </Link>
                <Link href="/demo" className="btn-secondary sm:min-w-[180px]">
                  Book demo
                </Link>
                <Link
                  href="/compare"
                  className="text-sm font-semibold text-[color:var(--text-primary)] hover:text-accent hover:underline"
                >
                  Compare with NZ alternatives
                </Link>
              </div>
            </div>
          </div>
        </section>

        <footer className="surface-panel px-4 py-3 text-center text-xs text-secondary sm:text-sm">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
            <span>Copyright {new Date().getFullYear()} InductLite. All rights reserved.</span>
            <span aria-hidden="true" className="text-muted">
              |
            </span>
            <ThemeSwitcher showLabel={false} className="text-[11px]" />
            <span aria-hidden="true" className="text-muted">
              |
            </span>
            <Link href="/terms" className="text-[color:var(--text-primary)] hover:text-accent hover:underline">
              Terms
            </Link>
            <span aria-hidden="true" className="text-muted">
              |
            </span>
            <Link href="/privacy" className="text-[color:var(--text-primary)] hover:text-accent hover:underline">
              Privacy
            </Link>
            <span aria-hidden="true" className="text-muted">
              |
            </span>
            <a
              href="mailto:support@inductlite.nz"
              className="text-[color:var(--text-primary)] hover:text-accent hover:underline"
            >
              Support
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
