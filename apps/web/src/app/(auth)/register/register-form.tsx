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
      className="w-full rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
          Company Name
        </label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          autoComplete="organization"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          placeholder="BuildRight NZ"
        />
        {getFieldError("companyName") && (
          <p className="mt-1 text-sm text-red-600">{getFieldError("companyName")}</p>
        )}
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Your Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          placeholder="Site foreman name"
        />
        {getFieldError("name") && (
          <p className="mt-1 text-sm text-red-600">{getFieldError("name")}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Work Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          placeholder="you@company.co.nz"
        />
        {getFieldError("email") && (
          <p className="mt-1 text-sm text-red-600">{getFieldError("email")}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          placeholder="At least 8 chars, upper/lower/number"
        />
        {getFieldError("password") && (
          <p className="mt-1 text-sm text-red-600">{getFieldError("password")}</p>
        )}
      </div>

      <div>
        <label htmlFor="siteName" className="block text-sm font-medium text-gray-700">
          First Site Name
        </label>
        <input
          id="siteName"
          name="siteName"
          type="text"
          autoComplete="off"
          required
          defaultValue="Main Site"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
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

