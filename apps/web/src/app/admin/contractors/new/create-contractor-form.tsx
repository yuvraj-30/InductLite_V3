"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createContractorAction,
  type ContractorActionResult,
} from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary"
    >
      {pending ? "Creating..." : "Create Contractor"}
    </button>
  );
}

export default function CreateContractorForm() {
  const initialState: ContractorActionResult | null = null;
  const router = useRouter();
  const [state, formAction] = useActionState(
    createContractorAction,
    initialState,
  );

  useEffect(() => {
    if (state?.success) {
      router.push("/admin/contractors");
    }
  }, [state, router]);

  const getFieldError = (field: string): string | undefined => {
    if (state && !state.success && state.fieldErrors) {
      return state.fieldErrors[field]?.[0];
    }
    return undefined;
  };

  return (
    <form action={formAction} className="space-y-6">
      {state && !state.success && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-secondary"
          >
            Contractor Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={120}
            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)]"
          />
          {getFieldError("name") && (
            <p className="mt-1 text-xs text-red-600">{getFieldError("name")}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="trade"
            className="block text-sm font-medium text-secondary"
          >
            Trade
          </label>
          <input
            id="trade"
            name="trade"
            type="text"
            maxLength={120}
            placeholder="Electrician"
            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)]"
          />
          {getFieldError("trade") && (
            <p className="mt-1 text-xs text-red-600">{getFieldError("trade")}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label
            htmlFor="contactName"
            className="block text-sm font-medium text-secondary"
          >
            Contact Name
          </label>
          <input
            id="contactName"
            name="contactName"
            type="text"
            maxLength={120}
            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)]"
          />
          {getFieldError("contactName") && (
            <p className="mt-1 text-xs text-red-600">
              {getFieldError("contactName")}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="contactEmail"
            className="block text-sm font-medium text-secondary"
          >
            Contact Email
          </label>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            maxLength={160}
            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)]"
          />
          {getFieldError("contactEmail") && (
            <p className="mt-1 text-xs text-red-600">
              {getFieldError("contactEmail")}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="contactPhone"
            className="block text-sm font-medium text-secondary"
          >
            Contact Phone
          </label>
          <input
            id="contactPhone"
            name="contactPhone"
            type="text"
            maxLength={30}
            placeholder="+64..."
            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)]"
          />
          {getFieldError("contactPhone") && (
            <p className="mt-1 text-xs text-red-600">
              {getFieldError("contactPhone")}
            </p>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-secondary"
        >
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          maxLength={500}
          className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)]"
        />
        {getFieldError("notes") && (
          <p className="mt-1 text-xs text-red-600">{getFieldError("notes")}</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <Link
          href="/admin/contractors"
          className="btn-secondary"
        >
          Cancel
        </Link>
        <SubmitButton />
      </div>
    </form>
  );
}

