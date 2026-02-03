"use client";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
    >
      {pending ? "Creating..." : "Create Site"}
    </button>
  );
}

/**
 * Create Site Form Component
 */

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createSiteAction, SiteActionResult } from "../actions";

export default function CreateSiteForm() {
  const initialState: SiteActionResult | null = null;
  const router = useRouter();
  const [state, formAction] = useActionState(createSiteAction, initialState);

  useEffect(() => {
    if (state?.success) {
      // Redirect to the new site page or sites list
      router.push("/admin/sites");
    }
  }, [state, router]);

  // Helper to get field errors
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
    <form action={formAction} className="space-y-6">
      {state && !state.success && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700 text-sm">{state.error}</p>
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700"
        >
          Site Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={100}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="e.g., 123 Main Street Renovation"
        />
        {getFieldError("name") && (
          <p className="mt-1 text-sm text-red-600">{getFieldError("name")}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="address"
          className="block text-sm font-medium text-gray-700"
        >
          Address
        </label>
        <input
          type="text"
          id="address"
          name="address"
          maxLength={200}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="e.g., 123 Main Street, Auckland 1010"
        />
        {getFieldError("address") && (
          <p className="mt-1 text-sm text-red-600">
            {getFieldError("address")}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="Optional description of the site or project"
        />
        {getFieldError("description") && (
          <p className="mt-1 text-sm text-red-600">
            {getFieldError("description")}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <SubmitButton />
      </div>
    </form>
  );
}
