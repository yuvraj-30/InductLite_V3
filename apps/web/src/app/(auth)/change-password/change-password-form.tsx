"use client";

/**
 * Change Password Form Component
 */

import { useFormState, useFormStatus } from "react-dom";
import { changePasswordAction, type ActionResult } from "../actions";

function FormFields() {
  const { pending } = useFormStatus();

  return (
    <>
      {/* Current password */}
      <div>
        <label
          htmlFor="currentPassword"
          className="block text-sm font-medium text-gray-700"
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
            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* New password */}
      <div>
        <label
          htmlFor="newPassword"
          className="block text-sm font-medium text-gray-700"
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
            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          At least 8 characters with uppercase, lowercase, and number
        </p>
      </div>

      {/* Confirm password */}
      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-gray-700"
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
            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* Submit button */}
      <div>
        <button
          type="submit"
          disabled={pending}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Changing password..." : "Change password"}
        </button>
      </div>
    </>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    changePasswordAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-6">
      {/* Error message */}
      {state && !state.success && (
        <div
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm"
          role="alert"
        >
          {state.error}
        </div>
      )}

      {/* Success message */}
      {state?.success && (
        <div
          className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm"
          role="alert"
        >
          {state.message || "Password changed successfully"}
        </div>
      )}

      <FormFields />
    </form>
  );
}
