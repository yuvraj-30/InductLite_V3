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
    <section className="surface-panel p-5">
      <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">LMS Completion Sync</h2>
      <p className="mt-1 text-sm text-secondary">
        Configure one-way completion syncing to your LMS endpoint.
      </p>
      <p className="mt-1 text-xs text-muted">
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
        <label className="inline-flex items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={initialEnabled}
            className="h-4 w-4 rounded border-[color:var(--border-soft)] text-accent focus:ring-[color:var(--accent-primary)]"
          />
          Enable LMS completion sync for this site
        </label>

        <div>
          <label
            htmlFor="endpointUrl"
            className="block text-sm font-medium text-secondary"
          >
            Endpoint URL
          </label>
          <input
            id="endpointUrl"
            name="endpointUrl"
            type="url"
            defaultValue={initialEndpointUrl}
            placeholder="https://lms.example.com/inductlite/completions"
            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm shadow-sm focus:border-[color:var(--accent-primary)] focus:ring-[color:var(--accent-primary)]"
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
          <label className="text-sm text-secondary">
            Provider (optional)
            <input
              name="provider"
              defaultValue={initialProvider}
              placeholder="Moodle"
              className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm shadow-sm focus:border-[color:var(--accent-primary)] focus:ring-[color:var(--accent-primary)]"
            />
          </label>
          <label className="text-sm text-secondary">
            Course Code (optional)
            <input
              name="courseCode"
              defaultValue={initialCourseCode}
              placeholder="SITE-INDUCT-101"
              className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm shadow-sm focus:border-[color:var(--accent-primary)] focus:ring-[color:var(--accent-primary)]"
            />
          </label>
        </div>

        <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-4">
          <label className="block text-sm text-secondary">
            Auth Token (optional)
            <input
              name="authToken"
              type="password"
              minLength={12}
              autoComplete="new-password"
              placeholder={
                hasAuthToken ? "Leave blank to keep current token" : "Paste token"
              }
              className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm shadow-sm focus:border-[color:var(--accent-primary)] focus:ring-[color:var(--accent-primary)]"
            />
          </label>
          {state &&
            !state.success &&
            state.fieldErrors?.authToken?.[0] && (
              <p className="mt-1 text-sm text-red-600">
                {state.fieldErrors.authToken[0]}
              </p>
            )}

          <label className="mt-3 inline-flex items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              name="clearAuthToken"
              className="h-4 w-4 rounded border-[color:var(--border-soft)] text-accent focus:ring-[color:var(--accent-primary)]"
            />
            Clear stored auth token
          </label>
        </div>

        <button
          type="submit"
          className="btn-primary min-h-[42px]"
        >
          Save LMS Settings
        </button>
      </form>
    </section>
  );
}


