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
      className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Sending..." : "Send magic link"}
    </button>
  );
}

export function MagicLinkForm({ formId = "magic-link-form" }: { formId?: string }) {
  const [state, formAction] = useActionState<MagicLinkResult | null, FormData>(
    requestContractorMagicLinkAction,
    null,
  );

  return (
    <form id={formId} action={formAction} className="space-y-6">
      {state && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            state.success
              ? "border-emerald-400/50 bg-emerald-100/70 text-emerald-950 dark:border-emerald-500/55 dark:bg-emerald-950/45 dark:text-emerald-100"
              : "border-red-400/50 bg-red-100/70 text-red-950 dark:border-red-500/60 dark:bg-red-950/45 dark:text-red-100"
          }`}
          role="alert"
        >
          {state.message}
        </div>
      )}

      <div>
        <label htmlFor="siteSlug" className="label">
          Site link or slug
        </label>
        <div className="mt-1">
          <input
            id="siteSlug"
            name="siteSlug"
            type="text"
            autoComplete="off"
            required
            className="input"
            placeholder="https://example.com/s/site-slug"
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="label">
          Email address
        </label>
        <div className="mt-1">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="input"
            placeholder="you@company.co.nz"
          />
        </div>
      </div>

      <SubmitButton />

      <p className="text-xs text-secondary">
        We will email you a one-time link to access your contractor portal.
      </p>
    </form>
  );
}
