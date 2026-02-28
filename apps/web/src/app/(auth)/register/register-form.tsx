"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { registerAction, type RegisterActionResult } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full"
    >
      {pending ? "Creating workspace..." : "Create Workspace"}
    </button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState<RegisterActionResult | null, FormData>(
    registerAction,
    null,
  );

  const getFieldError = (field: string): string | undefined => {
    if (
      state &&
      !state.success &&
      "fieldErrors" in state &&
      state.fieldErrors
    ) {
      return state.fieldErrors[field]?.[0];
    }
    return undefined;
  };

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div
          role="alert"
          className="rounded-xl border border-red-400/45 bg-red-100/70 px-4 py-3 text-sm text-red-950 dark:bg-red-950/45 dark:text-red-100"
        >
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="companyName" className="label">
          Company Name
        </label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          autoComplete="organization"
          required
          className="input mt-1"
          placeholder="BuildRight NZ"
        />
        {getFieldError("companyName") && (
          <p className="mt-1 text-sm text-red-600">{getFieldError("companyName")}</p>
        )}
      </div>

      <div>
        <label htmlFor="name" className="label">
          Your Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          className="input mt-1"
          placeholder="Site foreman name"
        />
        {getFieldError("name") && (
          <p className="mt-1 text-sm text-red-600">{getFieldError("name")}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="label">
          Work Email
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
        {getFieldError("email") && (
          <p className="mt-1 text-sm text-red-600">{getFieldError("email")}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="input mt-1"
          placeholder="At least 8 chars, upper/lower/number"
        />
        {getFieldError("password") && (
          <p className="mt-1 text-sm text-red-600">{getFieldError("password")}</p>
        )}
      </div>

      <div>
        <label htmlFor="siteName" className="label">
          First Site Name
        </label>
        <input
          id="siteName"
          name="siteName"
          type="text"
          autoComplete="off"
          required
          defaultValue="Main Site"
          className="input mt-1"
          placeholder="Main Site"
        />
        {getFieldError("siteName") && (
          <p className="mt-1 text-sm text-red-600">{getFieldError("siteName")}</p>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
