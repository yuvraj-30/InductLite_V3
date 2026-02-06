"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  requestContractorMagicLinkAction,
  type MagicLinkResult,
} from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Sending..." : "Send magic link"}
    </button>
  );
}

export function MagicLinkForm() {
  const [state, formAction] = useActionState<MagicLinkResult | null, FormData>(
    requestContractorMagicLinkAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-6">
      {state && (
        <div
          className={`border px-4 py-3 rounded-md text-sm ${
            state.success
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
          role="alert"
        >
          {state.message}
        </div>
      )}

      <div>
        <label
          htmlFor="siteSlug"
          className="block text-sm font-medium text-gray-700"
        >
          Site link or slug
        </label>
        <div className="mt-1">
          <input
            id="siteSlug"
            name="siteSlug"
            type="text"
            autoComplete="off"
            required
            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="https://example.com/s/site-slug"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700"
        >
          Email address
        </label>
        <div className="mt-1">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="you@company.co.nz"
          />
        </div>
      </div>

      <SubmitButton />

      <p className="text-xs text-gray-500">
        We will email you a one-time link to access your contractor portal.
      </p>
    </form>
  );
}
