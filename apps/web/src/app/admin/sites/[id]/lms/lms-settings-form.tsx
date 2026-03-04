"use client";

import { useActionState, useMemo } from "react";
import {
  type SiteLmsConnectorActionResult,
  updateSiteLmsConnectorAction,
} from "./actions";

interface LmsSettingsFormProps {
  siteId: string;
  initialEnabled: boolean;
  initialEndpointUrl: string;
  initialProvider: string;
  initialCourseCode: string;
  hasAuthToken: boolean;
  updatedAt: string | null;
}

const initialState: SiteLmsConnectorActionResult | null = null;

function formatTimestamp(value: string | null): string {
  if (!value) return "Not configured";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString("en-NZ", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LmsSettingsForm({
  siteId,
  initialEnabled,
  initialEndpointUrl,
  initialProvider,
  initialCourseCode,
  hasAuthToken,
  updatedAt,
}: LmsSettingsFormProps) {
  const boundAction = useMemo(
    () => updateSiteLmsConnectorAction.bind(null, siteId),
    [siteId],
  );
  const [state, formAction] = useActionState(boundAction, initialState);

  return (
    <section className="rounded-lg border bg-white p-5">
      <h2 className="text-lg font-semibold text-gray-900">LMS Completion Sync</h2>
      <p className="mt-1 text-sm text-gray-600">
        Configure one-way completion syncing to your LMS endpoint.
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Last updated: {formatTimestamp(updatedAt)}
        {" | "}
        Auth token: {hasAuthToken ? "Configured" : "Not configured"}
      </p>

      {state && !state.success && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {state.message}
        </div>
      )}

      <form action={formAction} className="mt-4 space-y-4">
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={initialEnabled}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Enable LMS completion sync for this site
        </label>

        <div>
          <label
            htmlFor="endpointUrl"
            className="block text-sm font-medium text-gray-700"
          >
            Endpoint URL
          </label>
          <input
            id="endpointUrl"
            name="endpointUrl"
            type="url"
            defaultValue={initialEndpointUrl}
            placeholder="https://lms.example.com/inductlite/completions"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          {state &&
            !state.success &&
            state.fieldErrors?.endpointUrl?.[0] && (
              <p className="mt-1 text-sm text-red-600">
                {state.fieldErrors.endpointUrl[0]}
              </p>
            )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-gray-700">
            Provider (optional)
            <input
              name="provider"
              defaultValue={initialProvider}
              placeholder="Moodle"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </label>
          <label className="text-sm text-gray-700">
            Course Code (optional)
            <input
              name="courseCode"
              defaultValue={initialCourseCode}
              placeholder="SITE-INDUCT-101"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </label>
        </div>

        <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
          <label className="block text-sm text-gray-700">
            Auth Token (optional)
            <input
              name="authToken"
              type="password"
              minLength={12}
              autoComplete="new-password"
              placeholder={
                hasAuthToken ? "Leave blank to keep current token" : "Paste token"
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </label>
          {state &&
            !state.success &&
            state.fieldErrors?.authToken?.[0] && (
              <p className="mt-1 text-sm text-red-600">
                {state.fieldErrors.authToken[0]}
              </p>
            )}

          <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="clearAuthToken"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Clear stored auth token
          </label>
        </div>

        <button
          type="submit"
          className="min-h-[42px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Save LMS Settings
        </button>
      </form>
    </section>
  );
}

