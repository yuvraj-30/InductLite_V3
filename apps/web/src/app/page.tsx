import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { TierPresentation } from "@/lib/plans/tier-presentation";
import { TIER_PRESENTATION } from "@/lib/plans/tier-presentation";
import { cn } from "@/lib/utils";

// Nonce-based CSP requires runtime rendering so Next can attach per-request nonce
// attributes to inline hydration scripts.
export const dynamic = "force-dynamic";

const TRUST_BADGES = [
  "QR sign-in and induction in one flow",
  "Live register, muster, and audit records",
  "Tenant-scoped security by default",
];

const GUIDED_ROLLOUT_POINTS = [
  "Map your current paper, spreadsheet, or legacy sign-in process.",
  "Launch the first site flow for workers, visitors, and supervisors.",
  "Go live with export-ready records from day one.",
];

const PRIMARY_FEATURE_GROUP = {
  title: "Sign-in and induction",
  detail:
    "Move arrival, induction content, signatures, and exception handling into one worker-friendly flow.",
  highlights: [
    "QR + geolocation sign-in for workers and visitors.",
    "Media-first induction builder with scoring, retries, and signatures.",
    "Supervisor escalation paths for failed or incomplete inductions.",
    "Site entry flows that stay mobile-ready without extra admin friction.",
  ],
};

const SUPPORTING_FEATURE_GROUPS = [
  {
    title: "Compliance and permits",
    detail:
      "Control permits, access rules, and contractor readiness before people step onto site.",
    highlights: [
      "Permit-to-work lifecycle",
      "Contractor compliance tracking",
      "Construction safety form suite",
    ],
  },
  {
    title: "Emergency and live operations",
    detail:
      "Know who is on-site in real time, run muster fast, and keep the follow-up trail intact.",
    highlights: [
      "Live register operations",
      "Emergency roll-call",
      "Broadcasts with acknowledgement",
    ],
  },
  {
    title: "Identity and visitor controls",
    detail:
      "Reduce unknown access with policy-driven approvals and verification records tied to each visit.",
    highlights: [
      "Visitor approvals",
      "Watchlist screening",
      "Random checks and identity hardening",
    ],
  },
  {
    title: "Evidence and exports",
    detail:
      "Keep decisions, attendance, and compliance records ready for clients, audits, and incident follow-up.",
    highlights: [
      "Compliance export packs",
      "Retention-aware record handling",
      "Audit-ready evidence trails",
    ],
  },
];

const FEATURE_SWITCH_POINTS = [
  "Replace paper sign-in books and scattered induction packs.",
  "Give supervisors live visibility without slowing the front gate.",
  "Keep records ready when clients or auditors ask for the evidence.",
];

const FEATURE_WORKFORCES = ["Contractors", "Visitors", "Delivery drivers", "Supervisors"];

const INTEGRATION_FEATURES = [
  "Teams/Slack channel notifications with actionable approval callbacks",
  "Outbound webhooks for external systems",
  "LMS connector configuration per site",
  "Unified communication event feed and delivery diagnostics",
  "Hardware access decision adapter (entitlement-gated)",
  "Named access connectors (HID Origo, Brivo, Gallagher, LenelS2, Genetec)",
  "Email and SMS workflow support (plan/add-on controlled)",
];

const PLAN_TIERS = TIER_PRESENTATION.filter(
  (item): item is TierPresentation & { key: "STANDARD" | "PLUS" | "PRO"; priceCents: number } =>
    item.key !== "ADD_ONS" && Number.isFinite(item.priceCents),
);

const ADD_ONS_TIER = TIER_PRESENTATION.find((item) => item.key === "ADD_ONS");

const LATEST_RELEASES = [
  "Permit-to-Work / Control-of-Work workflows",
  "Construction safety form suite (SWMS/JSA/RAMS/Toolbox/Fatigue)",
  "Identity hardening (watchlists, random checks, verification records)",
  "Emergency broadcast + acknowledgement + incident evidence linkage",
  "Teams/Slack notifications with approval action callbacks",
  "Safety policy simulator with exportable run reports",
  "Cross-site contractor risk passport with trend views",
  "Tamper-evident compliance evidence verification APIs",
  "Self-serve plan configurator with scheduled plan changes",
];

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
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-6">
        <header className="surface-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
              InductLite
            </p>
            <p className="text-xs text-muted">NZ site induction and visitor operations</p>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold sm:text-sm">
            <a href="#features" className="rounded-lg px-2 py-1 text-secondary hover:text-accent">
              Features
            </a>
            <a href="#integrations" className="rounded-lg px-2 py-1 text-secondary hover:text-accent">
              Integrations
            </a>
            <Link href="/pricing" className="rounded-lg px-2 py-1 text-secondary hover:text-accent">
              Pricing
            </Link>
            <Link href="/demo" className="rounded-lg px-2 py-1 text-secondary hover:text-accent">
              Book demo
            </Link>
            <Link href="/compare" className="rounded-lg px-2 py-1 text-secondary hover:text-accent">
              Compare
            </Link>
            <Link href="/login" className="btn-secondary px-3 py-2">
              Login
            </Link>
          </nav>
        </header>

        <section className="surface-panel-strong overflow-hidden p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-start">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                Live site induction for NZ construction teams
              </p>
              <h1 className="kinetic-title mt-3 max-w-[11ch] text-4xl font-bold leading-[0.98] tracking-tight sm:text-5xl">
                Start every site induction with one clear, compliant flow.
              </h1>
              <p className="mt-4 max-w-2xl text-sm text-secondary sm:text-base">
                From QR sign-in to induction records, live registers, and emergency roll-call,
                InductLite keeps people moving and evidence ready.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="btn-primary w-full sm:w-auto sm:min-w-[220px]">
                  Start free
                </Link>
                <Link href="/demo" className="btn-secondary w-full sm:w-auto sm:min-w-[180px]">
                  Book demo
                </Link>
              </div>
              <p className="mt-3 text-xs text-muted">
                Self-serve first, then bring us in when you want rollout support.
              </p>
            </div>

            <div className="surface-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                Guided rollout
              </p>
              <h2 className="mt-2 text-xl font-bold text-[color:var(--text-primary)]">
                Book a tailored walkthrough
              </h2>
              <p className="mt-2 text-sm text-secondary">
                We will map your current sign-in, induction, and compliance process to a cleaner
                live workflow.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-secondary">
                {GUIDED_ROLLOUT_POINTS.map((item, index) => (
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
                  Most teams start with
                </p>
                <p className="mt-1 text-sm text-secondary">
                  one site, one QR entry point, and one induction template.
                </p>
              </div>
              <Link
                href="/demo"
                className="mt-4 inline-flex text-sm font-semibold text-[color:var(--text-primary)] hover:text-accent hover:underline"
              >
                Book demo
              </Link>
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
                Built for NZ site teams that need sign-in, induction, live registers, and records
                to stay in sync.
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

        <section id="features" className="surface-panel px-5 py-6 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold">One platform from arrival to audit trail</h2>
            <p className="mt-2 text-sm text-secondary">
              Buyers do not compare isolated features. They compare whether sign-in, induction,
              compliance, emergency response, and records work as one operating flow.
            </p>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <article className="bento-card lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                Primary workflow
              </p>
              <h3 className="mt-2 text-2xl font-bold">{PRIMARY_FEATURE_GROUP.title}</h3>
              <p className="mt-2 max-w-2xl text-sm text-secondary">{PRIMARY_FEATURE_GROUP.detail}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {PRIMARY_FEATURE_GROUP.highlights.map((item) => (
                  <p
                    key={item}
                    className="rounded-xl border border-surface-soft bg-surface-soft px-4 py-3 text-sm text-secondary"
                  >
                    {item}
                  </p>
                ))}
              </div>
            </article>

            <article className="bento-card">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                Where teams feel it first
              </p>
              <h3 className="mt-2 text-xl font-bold">Less admin between arrival and approval.</h3>
              <p className="mt-2 text-sm text-secondary">
                InductLite is strongest when someone shows up, completes the right induction flow,
                and is visible in the live register without the site team rebuilding the record later.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-secondary">
                {FEATURE_SWITCH_POINTS.map((item) => (
                  <li key={item} className="rounded-lg border border-surface-soft bg-surface-soft px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                {FEATURE_WORKFORCES.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-surface-soft bg-surface-soft px-3 py-1 text-xs font-semibold text-secondary"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </article>

            {SUPPORTING_FEATURE_GROUPS.map((group) => (
              <article key={group.title} className="bento-card">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                  Grouped capability
                </p>
                <h3 className="mt-2 text-xl font-bold">{group.title}</h3>
                <p className="mt-2 text-sm text-secondary">{group.detail}</p>
                <ul className="mt-4 space-y-2 text-sm text-secondary">
                  {group.highlights.map((item) => (
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

        <section id="integrations" className="surface-panel px-5 py-6 sm:px-6">
          <h2 className="text-2xl font-bold">Integrations and Operations</h2>
          <p className="mt-2 text-sm text-secondary">
            Keep your workflow connected without adding enterprise-only complexity.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {INTEGRATION_FEATURES.map((item) => (
              <p
                key={item}
                className="rounded-xl border border-surface-soft bg-surface-soft px-4 py-3 text-sm text-secondary"
              >
                {item}
              </p>
            ))}
          </div>
        </section>

        <section id="pricing" className="surface-panel-strong px-5 py-6 sm:px-6">
          <h2 className="text-2xl font-bold">Simple Tier Coverage</h2>
          <p className="mt-2 text-sm text-secondary">
            Standard, Plus, Pro, and Add-ons are modeled as one consistent tier system across the app.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
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
                  <p className="text-sm text-secondary">{plan.subtitle}</p>
                  <ul className="space-y-2 text-xs text-secondary">
                    {plan.highlights.map((item) => (
                      <li key={item} className="rounded-lg border border-surface-soft bg-surface-soft px-2 py-1.5">
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
          {ADD_ONS_TIER ? (
            <div className="mt-4 rounded-xl border border-surface-soft bg-surface-soft p-4">
              <div className="flex items-center gap-2">
                <Badge variant={ADD_ONS_TIER.badgeTone}>{ADD_ONS_TIER.label}</Badge>
                <p className="text-sm text-secondary">{ADD_ONS_TIER.subtitle}</p>
              </div>
              <ul className="mt-3 grid gap-2 text-xs text-secondary md:grid-cols-2">
                {ADD_ONS_TIER.highlights.map((item) => (
                  <li key={item} className="rounded-lg bg-surface-soft px-2 py-1.5">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-3">
            <Link
              href="/pricing"
              className="text-sm font-semibold text-[color:var(--text-primary)] hover:text-accent hover:underline"
            >
              View full pricing and add-on details
            </Link>
          </div>
        </section>

        <section className="surface-panel px-5 py-6 sm:px-6">
          <h2 className="text-2xl font-bold">Latest Releases</h2>
          <p className="mt-2 text-sm text-secondary">
            Recently delivered features aligned to current NZ buyer demand.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {LATEST_RELEASES.map((item) => (
              <p
                key={item}
                className="rounded-lg border border-surface-soft bg-surface-soft px-3 py-2 text-sm text-secondary"
              >
                {item}
              </p>
            ))}
          </div>
          <div className="mt-4">
            <Link href="/compare" className="text-sm font-semibold text-[color:var(--text-primary)] hover:text-accent hover:underline">
              Compare InductLite with NZ competitors
            </Link>
          </div>
        </section>

        <section className="surface-panel-strong p-6 text-center">
          <h2 className="text-2xl font-bold">Ready to replace paper inductions?</h2>
          <p className="mt-2 text-sm text-secondary">
            Start free when you want to self-serve, or book a demo for a guided rollout.
          </p>
          <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/register" className="btn-primary sm:min-w-[220px]">
              Start free
            </Link>
            <Link href="/demo" className="btn-secondary sm:min-w-[220px]">
              Book demo
            </Link>
          </div>
        </section>

        <section className="bento-grid grid-cols-1 lg:grid-cols-3">
          <article className="bento-card lg:col-span-2">
            <h2 className="text-2xl font-bold">Support and Onboarding</h2>
            <p className="mt-2 text-sm text-secondary">
              Need rollout help for your first site/company? We can assist with setup,
              templates, and operator training.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-surface-soft bg-surface-soft p-3 text-sm text-secondary">
                <p className="font-semibold text-[color:var(--text-primary)]">Admin Setup</p>
                <p className="mt-1">Company, users, and role configuration.</p>
              </div>
              <div className="rounded-xl border border-surface-soft bg-surface-soft p-3 text-sm text-secondary">
                <p className="font-semibold text-[color:var(--text-primary)]">Template Build</p>
                <p className="mt-1">Induction question and media structure.</p>
              </div>
              <div className="rounded-xl border border-surface-soft bg-surface-soft p-3 text-sm text-secondary">
                <p className="font-semibold text-[color:var(--text-primary)]">Go-Live Checks</p>
                <p className="mt-1">Public flow validation and export verification.</p>
              </div>
            </div>
          </article>

          <article className="bento-card">
            <h2 className="text-xl font-bold">Contact</h2>
            <p className="mt-2 text-sm text-secondary">
              Book a walkthrough for your current process and we will map it to
              Standard, Plus, and Pro scope.
            </p>
            <div className="cyber-divider mt-4" />
            <p className="mt-4 text-xs uppercase tracking-[0.12em] text-muted">
              Sales and support
            </p>
            <a
              href="mailto:sales@inductlite.nz"
              className="mt-2 inline-flex text-sm font-semibold text-[color:var(--text-primary)] hover:text-accent hover:underline"
            >
              sales@inductlite.nz
            </a>
            <a
              href="mailto:support@inductlite.nz"
              className="mt-1 inline-flex text-xs text-secondary hover:text-accent hover:underline"
            >
              support@inductlite.nz
            </a>
          </article>
        </section>

        <footer className="surface-panel px-4 py-3 text-center text-xs text-secondary sm:text-sm">
          <p>
            Copyright {new Date().getFullYear()} InductLite. All rights reserved.
          </p>
          <p className="mt-1">
            <Link href="/terms" className="text-[color:var(--text-primary)] hover:text-accent hover:underline">
              Terms
            </Link>{" "}
            |{" "}
            <Link href="/privacy" className="text-[color:var(--text-primary)] hover:text-accent hover:underline">
              Privacy
            </Link>{" "}
            |{" "}
            <a
              href="mailto:support@inductlite.nz"
              className="text-[color:var(--text-primary)] hover:text-accent hover:underline"
            >
              Support
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
