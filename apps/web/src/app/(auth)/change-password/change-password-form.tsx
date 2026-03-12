"use client";

/**
 * Change Password Form Component
 */

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { changePasswordAction, type ActionResult } from "../actions";

function FormFields() {
  const { pending } = useFormStatus();

  return (
    <>
      {/* Current password */}
      <div>
        <label
          htmlFor="currentPassword"
          className="label"
        >
          Current password
        </label>
        <div className="mt-1">
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
            className="input disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          />
        </div>
      </div>

      {/* New password */}
      <div>
        <label
          htmlFor="newPassword"
          className="label"
        >
          New password
        </label>
        <div className="mt-1">
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            disabled={pending}
            className="input disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          />
        </div>
        <p className="mt-1 text-xs text-muted">
          At least 8 characters with uppercase, lowercase, and number
        </p>
      </div>

      {/* Confirm password */}
      <div>
        <label
          htmlFor="confirmPassword"
          className="label"
        >
          Confirm new password
        </label>
        <div className="mt-1">
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            disabled={pending}
            className="input disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          />
        </div>
      </div>

      {/* Submit button */}
      <div>
        <button
          type="submit"
          disabled={pending}
          className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Changing password..." : "Change password"}
        </button>
      </div>
    </>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    changePasswordAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-6">
      {/* Error message */}
      {state && !state.success && (
        <div
          className="rounded-xl border border-red-400/45 bg-red-100/70 px-4 py-3 text-sm text-red-900 dark:bg-red-950/45 dark:text-red-200"
          role="alert"
        >
          {state.error}
        </div>
      )}

      {/* Success message */}
      {state?.success && (
        <div
          className="rounded-xl border border-emerald-400/45 bg-emerald-100/70 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/45 dark:text-emerald-200"
          role="alert"
        >
          {state.message || "Password changed successfully"}
        </div>
      )}

      <FormFields />
    </form>
  );
}
