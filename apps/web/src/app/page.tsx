import Link from "next/link";

// Nonce-based CSP requires runtime rendering so Next can attach per-request nonce
// attributes to inline hydration scripts.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden px-4 py-8 sm:px-6 sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-20 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <section className="surface-panel-strong kinetic-hover overflow-hidden p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
            Site Induction Management
          </p>
          <h1 className="kinetic-title mt-2 text-4xl font-black sm:text-5xl">
            InductLite
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-secondary sm:text-base">
            Modern visitor sign-in, induction evidence, and compliance operations
            for NZ construction teams.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="btn-primary w-full sm:w-auto sm:min-w-[180px]">
              Admin Login
            </Link>
            <Link href="/register" className="btn-secondary w-full sm:w-auto sm:min-w-[220px]">
              Start New Workspace
            </Link>
          </div>
        </section>

        <section className="bento-grid grid-cols-1 lg:grid-cols-3">
          <article className="bento-card lg:col-span-2">
            <h2 className="text-2xl font-bold">Fast Daily Operations</h2>
            <p className="mt-2 text-sm text-secondary">
              Use Command Mode for quick actions, monitor live presence, and
              complete audits without context switching.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/25 bg-white/35 p-3 text-sm text-secondary">
                <p className="font-semibold text-[color:var(--text-primary)]">Command Mode</p>
                <p className="mt-1">Keyboard-first admin workflows.</p>
              </div>
              <div className="rounded-xl border border-white/25 bg-white/35 p-3 text-sm text-secondary">
                <p className="font-semibold text-[color:var(--text-primary)]">Live Register</p>
                <p className="mt-1">Real-time site attendance visibility.</p>
              </div>
              <div className="rounded-xl border border-white/25 bg-white/35 p-3 text-sm text-secondary">
                <p className="font-semibold text-[color:var(--text-primary)]">Audit Trail</p>
                <p className="mt-1">Evidence-ready compliance history.</p>
              </div>
            </div>
          </article>

          <article className="bento-card">
            <h2 className="text-xl font-bold">Visitor Flow</h2>
            <p className="mt-2 text-sm text-secondary">
              Visitors use the public site link or QR code to sign in, complete
              inductions, and sign out safely.
            </p>
            <div className="cyber-divider mt-4" />
            <p className="mt-4 text-xs uppercase tracking-[0.12em] text-muted">
              Need help?
            </p>
            <a
              href="mailto:support@inductlite.nz"
              className="mt-2 inline-flex text-sm font-semibold text-accent hover:underline"
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
            <Link href="/terms" className="text-accent hover:underline">
              Terms
            </Link>{" "}
            |{" "}
            <Link href="/privacy" className="text-accent hover:underline">
              Privacy
            </Link>{" "}
            |{" "}
            <a href="mailto:support@inductlite.nz" className="text-accent hover:underline">
              Support
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
