"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  submitDemoBookingAction,
  type DemoBookingActionResult,
} from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="btn-primary w-full sm:w-auto sm:min-w-[220px]" disabled={pending}>
      {pending ? "Submitting..." : "Request Demo"}
    </button>
  );
}

export function DemoBookingForm() {
  const [state, formAction] = useActionState<DemoBookingActionResult | null, FormData>(
    submitDemoBookingAction,
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

      {state && state.success && (
        <div
          role="status"
          className="rounded-xl border border-green-400/45 bg-green-100/70 px-4 py-3 text-sm text-green-950 dark:bg-green-950/45 dark:text-green-100"
        >
          <p>{state.message}</p>
          <p className="mt-1 text-xs">
            Reference: <span className="font-semibold">{state.requestReference}</span>
          </p>
        </div>
      )}

      <input type="hidden" name="sourcePath" value="/demo" />

      <div className="hidden" aria-hidden="true">
        <label htmlFor="website" className="label">
          Website
        </label>
        <input id="website" name="website" type="text" autoComplete="off" tabIndex={-1} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="fullName" className="label">
            Full Name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            className="input mt-1"
            placeholder="Alex Site Manager"
          />
          {getFieldError("fullName") && (
            <p className="mt-1 text-sm text-red-600">{getFieldError("fullName")}</p>
          )}
        </div>

        <div>
          <label htmlFor="workEmail" className="label">
            Work Email
          </label>
          <input
            id="workEmail"
            name="workEmail"
            type="email"
            autoComplete="email"
            required
            className="input mt-1"
            placeholder="you@company.co.nz"
          />
          {getFieldError("workEmail") && (
            <p className="mt-1 text-sm text-red-600">{getFieldError("workEmail")}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
          <label htmlFor="phone" className="label">
            Phone (Optional)
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className="input mt-1"
            placeholder="+64 21 123 4567"
          />
          {getFieldError("phone") && (
            <p className="mt-1 text-sm text-red-600">{getFieldError("phone")}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="siteCount" className="label">
            Approximate Site Count
          </label>
          <input
            id="siteCount"
            name="siteCount"
            type="number"
            min={1}
            max={500}
            className="input mt-1"
            placeholder="3"
          />
          {getFieldError("siteCount") && (
            <p className="mt-1 text-sm text-red-600">{getFieldError("siteCount")}</p>
          )}
        </div>

        <div>
          <label htmlFor="targetGoLiveDate" className="label">
            Target Go-Live Date (Optional)
          </label>
          <input
            id="targetGoLiveDate"
            name="targetGoLiveDate"
            type="date"
            className="input mt-1"
          />
          {getFieldError("targetGoLiveDate") && (
            <p className="mt-1 text-sm text-red-600">{getFieldError("targetGoLiveDate")}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="requirements" className="label">
          What do you need from the platform?
        </label>
        <textarea
          id="requirements"
          name="requirements"
          rows={5}
          required
          className="input mt-1"
          placeholder="Example: We run 6 active sites and need QR sign-in, induction scoring, and emergency roll-call reporting."
        />
        {getFieldError("requirements") && (
          <p className="mt-1 text-sm text-red-600">{getFieldError("requirements")}</p>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
