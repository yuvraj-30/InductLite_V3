"use client";

/**
 * Edit Site Form Component
 */

import { useFormState, useFormStatus } from "react-dom";
import { updateSiteAction, SiteActionResult } from "../actions";

interface Site {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
}

interface EditSiteFormProps {
  site: Site;
}

const initialState: SiteActionResult | null = null;

function FormFields({ site }: { site: Site }) {
  const { pending } = useFormStatus();

  return (
    <>
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
          defaultValue={site.name}
          required
          minLength={2}
          maxLength={100}
          disabled={pending}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
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
          defaultValue={site.address || ""}
          maxLength={200}
          disabled={pending}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
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
          defaultValue={site.description || ""}
          maxLength={500}
          disabled={pending}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </>
  );
}

export function EditSiteForm({ site }: EditSiteFormProps) {
  // Bind the siteId to the action
  const boundUpdateAction = updateSiteAction.bind(null, site.id);
  const [state, formAction] = useFormState(boundUpdateAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-red-700 text-sm">{state.error}</p>
        </div>
      )}

      {state?.success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <p className="text-green-700 text-sm">{state.message}</p>
        </div>
      )}

      <FormFields site={site} />
    </form>
  );
}
