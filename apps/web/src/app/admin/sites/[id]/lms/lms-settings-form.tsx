"use client";

import { useActionState, useMemo } from "react";
import { Alert } from "@/components/ui/alert";
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
        <Alert variant="error" className="mt-4">
          {state.error}
        </Alert>
      )}
      {state?.success && (
        <Alert variant="success" className="mt-4">
          {state.message}
        </Alert>
      )}

      <form action={formAction} className="mt-4 space-y-4">
        <label className="inline-flex items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={initialEnabled}
            className="check-control"
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
            className="input mt-1"
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
              className="input mt-1"
            />
          </label>
          <label className="text-sm text-secondary">
            Course Code (optional)
            <input
              name="courseCode"
              defaultValue={initialCourseCode}
              placeholder="SITE-INDUCT-101"
              className="input mt-1"
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
              className="input mt-1"
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
              className="check-control"
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


