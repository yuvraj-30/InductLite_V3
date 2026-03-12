"use client";

import { useActionState, useMemo } from "react";
import {
  rotateSiteWebhookSecretAction,
  updateSiteWebhooksAction,
  type SiteWebhookActionResult,
} from "./actions";

interface WebhookSettingsFormProps {
  siteId: string;
  initialUrls: string[];
  hasSiteSigningSecret: boolean;
  hasDefaultSigningSecret: boolean;
  signingSecretUpdatedAt: string | null;
}

const initialState: SiteWebhookActionResult | null = null;

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Not configured";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return parsed.toLocaleString("en-NZ", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WebhookSettingsForm({
  siteId,
  initialUrls,
  hasSiteSigningSecret,
  hasDefaultSigningSecret,
  signingSecretUpdatedAt,
}: WebhookSettingsFormProps) {
  const boundUpdateAction = useMemo(
    () => updateSiteWebhooksAction.bind(null, siteId),
    [siteId],
  );
  const boundRotateAction = useMemo(
    () => rotateSiteWebhookSecretAction.bind(null, siteId),
    [siteId],
  );

  const [updateState, updateFormAction] = useActionState(
    boundUpdateAction,
    initialState,
  );
  const [rotateState, rotateFormAction] = useActionState(
    boundRotateAction,
    initialState,
  );
  const effectiveSigningEnabled = hasSiteSigningSecret || hasDefaultSigningSecret;

  const signingStatusText = hasSiteSigningSecret
    ? "Enabled (site secret)"
    : hasDefaultSigningSecret
      ? "Enabled (global default secret)"
      : "Disabled";

  return (
    <div className="space-y-6">
      <section className="surface-panel p-5">
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Webhook Endpoints</h2>
        <p className="mt-1 text-sm text-secondary">
          Add one endpoint URL per line. Each endpoint receives
          <code className="mx-1 rounded bg-[color:var(--bg-surface-strong)] px-1 py-0.5 text-xs">
            induction.completed
          </code>
          events.
        </p>

        {updateState && !updateState.success && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {updateState.error}
          </div>
        )}
        {updateState?.success && (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {updateState.message}
          </div>
        )}

        <form action={updateFormAction} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="endpointUrls"
              className="block text-sm font-medium text-secondary"
            >
              Endpoint URLs
            </label>
            <textarea
              id="endpointUrls"
              name="endpointUrls"
              rows={8}
              defaultValue={initialUrls.join("\n")}
              className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm shadow-sm focus:border-[color:var(--accent-primary)] focus:ring-[color:var(--accent-primary)]"
              placeholder="https://example.com/webhooks/inductlite"
            />
            {updateState &&
              !updateState.success &&
              updateState.fieldErrors?.endpointUrls?.[0] && (
                <p className="mt-1 text-sm text-red-600">
                  {updateState.fieldErrors.endpointUrls[0]}
                </p>
              )}
          </div>

          <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-4">
            <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">
              Signing Secret
            </h3>
            <p className="mt-1 text-xs text-secondary">
              Current status: <span className="font-medium">{signingStatusText}</span>
              {" | "}
              Last rotated:{" "}
              {hasSiteSigningSecret
                ? formatTimestamp(signingSecretUpdatedAt)
                : "Managed by global configuration"}
            </p>
            {effectiveSigningEnabled && !hasSiteSigningSecret && (
              <p className="mt-2 text-xs text-secondary">
                Site deliveries currently use the global
                <code className="mx-1 rounded bg-[color:var(--bg-surface-strong)] px-1 py-0.5 text-[11px]">
                  WEBHOOK_SIGNING_SECRET
                </code>
                fallback.
              </p>
            )}

            <label className="mt-3 block text-sm text-secondary">
              Set new signing secret (optional)
              <input
                type="password"
                name="signingSecret"
                minLength={16}
                className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm shadow-sm focus:border-[color:var(--accent-primary)] focus:ring-[color:var(--accent-primary)]"
                placeholder="Leave blank to keep current secret"
                autoComplete="new-password"
              />
            </label>
            {updateState &&
              !updateState.success &&
              updateState.fieldErrors?.signingSecret?.[0] && (
                <p className="mt-1 text-sm text-red-600">
                  {updateState.fieldErrors.signingSecret[0]}
                </p>
              )}

            <label className="mt-3 inline-flex items-center gap-2 text-sm text-secondary">
              <input
                type="checkbox"
                name="clearSigningSecret"
                className="h-4 w-4 rounded border-[color:var(--border-soft)] text-accent focus:ring-[color:var(--accent-primary)]"
              />
              Disable signatures for this site (clears stored site secret)
            </label>
          </div>

          <button
            type="submit"
            className="btn-primary min-h-[42px]"
          >
            Save Webhook Settings
          </button>
        </form>
      </section>

      <section className="surface-panel p-5">
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
          Rotate Signing Secret
        </h2>
        <p className="mt-1 text-sm text-secondary">
          Generate a new secret and invalidate the previous one.
        </p>

        {rotateState && !rotateState.success && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {rotateState.error}
          </div>
        )}
        {rotateState?.success && (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            <p>{rotateState.message}</p>
            {rotateState.generatedSecret && (
              <>
                <p className="mt-2 text-xs text-green-900">
                  Copy this value now and update your receiver immediately.
                </p>
                <div className="mt-2 rounded border border-green-200 bg-[color:var(--bg-surface)] p-2 font-mono text-xs text-[color:var(--text-primary)]">
                  {rotateState.generatedSecret}
                </div>
              </>
            )}
          </div>
        )}

        <form action={rotateFormAction} className="mt-4">
          <button
            type="submit"
            className="min-h-[42px] rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-4 py-2 text-sm font-medium text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-strong)]"
          >
            Rotate Secret
          </button>
        </form>
      </section>
    </div>
  );
}


