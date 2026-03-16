"use client";

/**
 * Sign-Out Form Component
 *
 * Handles self-service sign-out with token verification.
 * Requires phone number confirmation for security.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitSignOut } from "@/app/s/[slug]/actions";

interface SignOutFormProps {
  initialToken: string;
  initialSlug?: string;
}

export function SignOutForm({ initialToken, initialSlug = "" }: SignOutFormProps) {
  const [token] = useState(initialToken);
  const [slug] = useState(initialSlug);
  const [phone, setPhone] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ visitorName: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError(
        "Invalid sign-out link. Please use the link from your sign-in confirmation.",
      );
      return;
    }

    if (!phone.trim()) {
      setError("Please enter your phone number");
      return;
    }

    startTransition(async () => {
      const result = await submitSignOut({
        token,
        phone: phone.trim(),
      });

      if (!result.success) {
        setError(result.error.message || "Failed to sign out");
        return;
      }

      setSuccess({ visitorName: result.data.visitorName });
    });
  };

  // Success state
  if (success) {
    return (
      <div className="surface-panel-strong overflow-hidden">
        <div className="bg-emerald-600 px-6 py-8 text-center text-white">
          <div className="mb-4 text-sm font-semibold uppercase tracking-[0.12em]">Visit closed</div>
          <h1 className="text-2xl font-bold">Signed Out Successfully</h1>
          <p className="mt-2 text-emerald-100">
            {success.visitorName} is now recorded as off site.
          </p>
        </div>

        <div className="px-6 py-6 text-center">
          <p className="mb-4 text-secondary">
            Your exit is now captured in the site audit trail. Have a safe journey.
          </p>
          {slug ? (
            <Link href={`/s/${slug}`} className="btn-secondary">
              Return to Sign-In
            </Link>
          ) : (
            <p className="text-sm text-muted">You may close this page now.</p>
          )}
        </div>
      </div>
    );
  }

  // No token provided
  if (!token) {
    return (
      <div className="surface-panel-strong overflow-hidden">
        <div className="bg-red-600 px-6 py-8 text-center text-white">
          <div className="mb-4 text-5xl">!</div>
          <h1 className="text-2xl font-bold">Invalid Link</h1>
        </div>

        <div className="px-6 py-6 text-center">
          <p className="mb-4 text-secondary">
            This sign-out link is invalid or has expired.
          </p>
          <p className="text-sm text-muted">
            Please use the sign-out link you received when signing in, or
            contact site reception for assistance.
          </p>
        </div>
      </div>
    );
  }

  // Sign-out form
  return (
      <div className="surface-panel-strong overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-700 to-cyan-700 px-6 py-6 text-center text-white">
          <h1 className="text-xl font-bold">Sign Out</h1>
          <p className="mt-1 text-sm text-cyan-100">
          Confirm your phone number to close this site visit
          </p>
        </div>

      {error && (
        <div className="border-b border-red-400/45 bg-red-100/70 px-4 py-3 dark:bg-red-950/45">
          <p className="text-sm text-red-950 dark:text-red-100">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-indigo-950 dark:text-indigo-100">
            Exit check
          </p>
          <ol className="mt-2 space-y-1 text-sm text-secondary">
            <li>1. Confirm the same phone number used at sign-in.</li>
            <li>2. Submit once to mark the visit as ended.</li>
            <li>3. Close the page or return to sign-in for a new visit.</li>
          </ol>
        </div>

        <div>
          <label htmlFor="signOutPhone" className="label mb-1">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <input
            id="signOutPhone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input"
            placeholder="Enter the phone number used to sign in"
          />
          <p className="mt-1 text-xs text-secondary">
            Enter the same phone number you used when signing in
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Signing out..." : "Confirm Sign Out"}
        </button>
      </form>

      <div className="border-t border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-6 py-4">
        <p className="text-center text-sm text-secondary">
          Having trouble? Contact site reception for assistance.
        </p>
      </div>
    </div>
  );
}
