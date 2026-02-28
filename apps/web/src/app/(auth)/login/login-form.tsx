"use client";

/**
 * Login Form Component
 *
 * Client component that handles the login form with useActionState
 * for progressive enhancement and server action integration.
 */

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
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
    <form action={formAction} className="space-y-6">
      {state && !state.success && (
        <div
          className="rounded-xl border border-red-400/45 bg-red-100/70 px-4 py-3 text-sm text-red-950 dark:bg-red-950/45 dark:text-red-100"
          role="alert"
        >
          {state.error}
        </div>
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

      <SubmitButton />
    </form>
  );
}
