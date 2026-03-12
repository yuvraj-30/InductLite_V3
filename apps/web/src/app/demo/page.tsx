import type { Metadata } from "next";
import Link from "next/link";
import { DemoBookingForm } from "./demo-booking-form";

export const metadata: Metadata = {
  title: "Book Demo | InductLite",
  description:
    "Book a live InductLite walkthrough for NZ site induction, visitor management, and compliance workflows.",
};

const DEMO_AGENDA = [
  "Public QR sign-in and induction flow from a contractor mobile view.",
  "Admin live register, escalation handling, and sign-out operations.",
  "Emergency roll-call execution and export evidence flow.",
  "Template builder, quiz rules, and multilingual/media setup.",
  "Pricing model: Standard, Plus, Pro, and add-on recommendations.",
];

const PREP_CHECKLIST = [
  "How many active sites you need to run.",
  "Whether you require pre-registration invites or visitor approvals.",
  "Any mandatory compliance evidence outputs you report to clients.",
  "Whether SMS, LMS, or hardware access integrations are required.",
  "Target go-live date and first pilot site.",
];

const SELF_GUIDED_FLOW = [
  "Create a workspace and add your first site.",
  "Publish a starter induction template with required questions.",
  "Run a real QR check-in from a phone and complete sign-out.",
  "Review live register and generate an evidence export.",
];

export default function DemoPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden px-4 py-8 sm:px-6 sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="surface-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
              Book Demo
            </p>
            <p className="text-sm text-secondary">See your end-to-end workflow in a live walkthrough.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="btn-secondary">
              Home
            </Link>
            <Link href="/pricing" className="btn-secondary">
              Pricing
            </Link>
            <Link href="/compare" className="btn-secondary">
              Compare
            </Link>
            <Link href="/register" className="btn-primary">
              Start Workspace
            </Link>
          </div>
        </header>

        <section className="surface-panel-strong p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <h1 className="kinetic-title text-4xl font-black sm:text-5xl">
                Get a tailored InductLite demo for your company.
              </h1>
              <p className="mt-3 text-sm text-secondary sm:text-base">
                We run a practical session using your real operational scenarios so you
                can confirm fit before rollout.
              </p>
              <p className="mt-3 text-xs text-muted">
                Complete the form and our team will confirm your session.
              </p>
              <Link href="/register" className="btn-secondary mt-4 inline-flex w-full sm:w-auto sm:min-w-[220px]">
                Start Self-Guided Trial
              </Link>
            </div>
            <div className="surface-panel p-4 lg:col-span-3">
              <h2 className="text-xl font-bold">Request a Demo</h2>
              <p className="mt-2 text-sm text-secondary">
                We usually respond within one business day.
              </p>
              <div className="mt-4">
                <DemoBookingForm />
              </div>
            </div>
          </div>
        </section>

        <section className="surface-panel px-5 py-6 sm:px-6">
          <h2 className="text-2xl font-bold">Live Demo Agenda</h2>
          <p className="mt-2 text-sm text-secondary">
            Typical demo duration: 30-45 minutes.
          </p>
          <ol className="mt-4 space-y-2 text-sm text-secondary">
            {DEMO_AGENDA.map((item, idx) => (
              <li key={item} className="rounded-lg border border-surface-soft bg-surface-soft px-3 py-2">
                {idx + 1}. {item}
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="surface-panel p-5">
            <h2 className="text-xl font-bold">What to Prepare</h2>
            <p className="mt-2 text-sm text-secondary">
              Share this before the call so we can tailor the walkthrough.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-secondary">
              {PREP_CHECKLIST.map((item) => (
                <li key={item} className="rounded-lg border border-surface-soft bg-surface-soft px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="surface-panel p-5">
            <h2 className="text-xl font-bold">Self-Guided Demo Path</h2>
            <p className="mt-2 text-sm text-secondary">
              If you want to test immediately, follow this sequence.
            </p>
            <ol className="mt-4 space-y-2 text-sm text-secondary">
              {SELF_GUIDED_FLOW.map((item, idx) => (
                <li key={item} className="rounded-lg border border-surface-soft bg-surface-soft px-3 py-2">
                  {idx + 1}. {item}
                </li>
              ))}
            </ol>
            <Link href="/register" className="btn-primary mt-4 w-full">
              Start Self-Guided Trial
            </Link>
          </article>
        </section>

        <section className="surface-panel-strong p-6 text-center">
          <h2 className="text-2xl font-bold">Need help choosing the right plan first?</h2>
          <p className="mt-2 text-sm text-secondary">
            Compare plan bands and add-ons before the demo so we focus on the right scope.
          </p>
          <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/pricing" className="btn-secondary sm:min-w-[220px]">
              View Pricing
            </Link>
            <Link href="/compare" className="btn-primary sm:min-w-[220px]">
              Compare Platforms
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
