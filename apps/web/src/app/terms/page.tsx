import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use | InductLite",
  description: "Terms governing use of InductLite for induction and site access.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-[color:var(--text-primary)]">Terms of Use</h1>
      <p className="mt-4 text-sm text-secondary">
        By using InductLite, users confirm that submitted induction details are
        accurate and acknowledge they must comply with all site safety rules and
        lawful instructions.
      </p>
      <p className="mt-3 text-sm text-secondary">
        Site operators are responsible for maintaining current induction content,
        emergency procedures, and hazard controls. InductLite provides record and
        workflow tooling but does not replace site-specific legal obligations.
      </p>
      <p className="mt-3 text-sm text-secondary">
        Access tokens and accounts are personal and must not be shared.
        Unauthorized use may result in access revocation.
      </p>
      <p className="mt-6 text-xs text-muted">Last updated: February 21, 2026</p>
    </main>
  );
}
