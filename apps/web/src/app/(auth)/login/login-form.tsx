"use client";

/**
 * Login Form Component
 *
 * Client component that handles the login form with useActionState
 * for progressive enhancement and server action integration.
 */

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { loginAction, type ActionResult } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    loginAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
          Password access
        </p>
        <p className="mt-2 text-sm text-secondary">
          Use your workspace admin email and password to return to live sites,
          compliance actions, and settings.
        </p>
      </div>

      {state && !state.success && (
        <Alert variant="error" title="Unable to sign in">
          {state.error}
        </Alert>
      )}

      <div>
        <label htmlFor="email" className="label">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input mt-1"
          placeholder="you@company.co.nz"
        />
      </div>

      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input mt-1"
          placeholder="********"
        />
      </div>

      {state?.requiresMfa && (
        <div>
          <label htmlFor="totp" className="label">
            MFA code
          </label>
          <input
            id="totp"
            name="totp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="input mt-1"
            placeholder="123456"
          />
        </div>
      )}

      <div className="space-y-3">
        <SubmitButton />
        <p className="text-xs text-muted">
          Password sign-in is best when you are managing sites directly from a
          secure device.
        </p>
      </div>
    </form>
  );
}
