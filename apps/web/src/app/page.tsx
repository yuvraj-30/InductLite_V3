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
  "NZ-focused compliance workflows",
  "Tenant-scoped security by default",
  "Audit-ready records and exports",
  "Mobile-ready public sign-in flow",
];

const STANDARD_FEATURES = [
  {
    title: "QR + geolocation sign-in",
    detail:
      "Visitors and contractors sign in from a QR/public link with location capture for site policy checks.",
  },
  {
    title: "Digital induction builder",
    detail:
      "Build question flows with scoring, retries, media blocks (PDF/video/image/text), and signatures.",
  },
  {
    title: "Live register operations",
    detail:
      "Track who is on-site in real time, with duration visibility and fast sign-out controls.",
  },
  {
    title: "Emergency roll-call",
    detail:
      "Run muster events, mark attendance, and export roll-call evidence for incident follow-up.",
  },
  {
    title: "Permit-to-work controls",
    detail:
      "Issue permit templates, run approval/activation lifecycle, and enforce permit-gated sign-in rules.",
  },
  {
    title: "Construction safety form suite",
    detail:
      "Run SWMS, JSA, RAMS, toolbox talk, and fatigue declaration workflows from one admin workspace.",
  },
  {
    title: "Visitor approvals + ID hardening",
    detail:
      "Use policy-based approvals, watchlist screening, random checks, and identity verification records.",
  },
  {
    title: "Emergency broadcasts with ACK",
    detail:
      "Send emergency broadcasts, track recipient acknowledgements, and monitor pending-response SLA timers.",
  },
  {
    title: "Contractor compliance tracking",
    detail:
      "Store contractor documents, expiry dates, and reminders to reduce expired access risk.",
  },
  {
    title: "Compliance export packs",
    detail:
      "Queue controlled CSV/PDF/ZIP exports with retention and audit logging to stay evidence-ready.",
  },
];

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
              Demo
            </Link>
            <Link href="/compare" className="rounded-lg px-2 py-1 text-secondary hover:text-accent">
              Compare
            </Link>
            <Link href="/login" className="btn-secondary px-3 py-2">
              Login
            </Link>
          </nav>
        </header>

        <section className="surface-panel-strong kinetic-hover overflow-hidden p-6 sm:p-8">
          <div className="grid gap-5 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                Competitor-grade, field-ready workflows
              </p>
              <h1 className="kinetic-title mt-2 text-4xl font-black sm:text-5xl">
                Replace paper inductions with a live compliance system.
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-secondary sm:text-base">
                InductLite gives NZ construction teams a full sign-in, induction,
                compliance, and emergency operations stack in one platform.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="btn-primary w-full sm:w-auto sm:min-w-[220px]">
                  Start Free Workspace
                </Link>
                <Link href="/demo" className="btn-secondary w-full sm:w-auto sm:min-w-[180px]">
                  Book Demo
                </Link>
              </div>
              <p className="mt-3 text-xs text-muted">
                Prefer to self-serve? Start now and configure your first site in minutes.
              </p>
            </div>

            <aside className="surface-panel p-4 lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                Typical Workflow
              </p>
              <ol className="mt-3 space-y-2 text-sm text-secondary">
                <li className="rounded-lg border border-surface-soft bg-surface-soft px-3 py-2">
                  1. Contractor scans QR at site entry.
                </li>
                <li className="rounded-lg border border-surface-soft bg-surface-soft px-3 py-2">
                  2. Completes media-first induction + signature.
                </li>
                <li className="rounded-lg border border-surface-soft bg-surface-soft px-3 py-2">
                  3. Supervisor gets alerts for escalations when required.
                </li>
                <li className="rounded-lg border border-surface-soft bg-surface-soft px-3 py-2">
                  4. Admin exports audit evidence on demand.
                </li>
              </ol>
            </aside>
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST_BADGES.map((badge) => (
              <p
                key={badge}
                className="rounded-lg border border-surface-soft bg-surface-soft px-3 py-2 text-xs font-semibold text-secondary"
              >
                {badge}
              </p>
            ))}
          </div>
        </section>

        <section id="features" className="surface-panel px-5 py-6 sm:px-6">
          <h2 className="text-2xl font-bold">What Clients Expect in 2026</h2>
          <p className="mt-2 text-sm text-secondary">
            These are the baseline capabilities buyers compare across NZ market options.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {STANDARD_FEATURES.map((feature) => (
              <article key={feature.title} className="rounded-xl border border-surface-soft bg-surface-soft p-4">
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                  {feature.title}
                </p>
                <p className="mt-2 text-xs text-secondary">{feature.detail}</p>
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
          <h2 className="text-2xl font-bold">Want the same sales-ready flow as top competitors?</h2>
          <p className="mt-2 text-sm text-secondary">
            Launch your workspace, configure your first site, and start collecting compliant records immediately.
          </p>
          <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/register" className="btn-primary sm:min-w-[220px]">
              Start New Workspace
            </Link>
            <Link href="/demo" className="btn-secondary sm:min-w-[220px]">
              Talk to Sales
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
