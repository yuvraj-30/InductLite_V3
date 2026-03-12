"use client";

import { useActionState, useMemo } from "react";
import {
  type SiteAccessControlActionResult,
  updateSiteAccessControlAction,
} from "./actions";

interface SiteAccessSettingsFormProps {
  siteId: string;
  initialGeofenceMode: "AUDIT" | "DENY" | "OVERRIDE";
  initialGeofenceAllowMissingLocation: boolean;
  hasGeofenceOverrideCode: boolean;
  initialGeofenceAutomationMode: "OFF" | "ASSIST" | "AUTO";
  initialGeofenceAutoCheckoutGraceMinutes: number;
  initialHardwareEnabled: boolean;
  initialHardwareProvider: string;
  initialHardwareEndpointUrl: string;
  hasHardwareAuthToken: boolean;
  initialIdentityEnabled: boolean;
  initialIdentityRequirePhoto: boolean;
  initialIdentityRequireIdScan: boolean;
  initialIdentityRequireConsent: boolean;
  initialIdentityRequireOcrVerification: boolean;
  initialIdentityAllowedDocumentTypes: string[];
  initialIdentityOcrDecisionMode: "assist" | "strict";
  canEnableGeofence: boolean;
  canEnableHardware: boolean;
  canEnableMobileAssist: boolean;
  canEnableIdentityHardening: boolean;
  canEnableIdentityOcr: boolean;
  updatedAt: string | null;
}

const initialState: SiteAccessControlActionResult | null = null;

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

export function SiteAccessSettingsForm({
  siteId,
  initialGeofenceMode,
  initialGeofenceAllowMissingLocation,
  hasGeofenceOverrideCode,
  initialGeofenceAutomationMode,
  initialGeofenceAutoCheckoutGraceMinutes,
  initialHardwareEnabled,
  initialHardwareProvider,
  initialHardwareEndpointUrl,
  hasHardwareAuthToken,
  initialIdentityEnabled,
  initialIdentityRequirePhoto,
  initialIdentityRequireIdScan,
  initialIdentityRequireConsent,
  initialIdentityRequireOcrVerification,
  initialIdentityAllowedDocumentTypes,
  initialIdentityOcrDecisionMode,
  canEnableGeofence,
  canEnableHardware,
  canEnableMobileAssist,
  canEnableIdentityHardening,
  canEnableIdentityOcr,
  updatedAt,
}: SiteAccessSettingsFormProps) {
  const boundAction = useMemo(
    () => updateSiteAccessControlAction.bind(null, siteId),
    [siteId],
  );
  const [state, formAction] = useActionState(boundAction, initialState);

  return (
    <section className="surface-panel p-5">
      <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
        Geofence + Hardware Controls
      </h2>
      <p className="mt-1 text-sm text-secondary">
        Configure strict location enforcement and optional gate/turnstile
        integrations.
      </p>
      <p className="mt-1 text-xs text-muted">
        Last updated: {formatTimestamp(updatedAt)}
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

      <form action={formAction} className="mt-4 space-y-5">
        <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-4">
          <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">
            Geofence Enforcement
          </h3>
          <p className="mt-1 text-xs text-secondary">
            `AUDIT` never blocks sign-in. `DENY` blocks outside radius. `OVERRIDE`
            requires a supervisor code when outside radius.
          </p>

          <label className="mt-3 block text-sm text-secondary">
            Mode
            <select
              name="geofenceMode"
              defaultValue={initialGeofenceMode}
              disabled={!canEnableGeofence}
              className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
            >
              <option value="AUDIT">Audit only (Standard-safe)</option>
              <option value="DENY">Deny outside radius</option>
              <option value="OVERRIDE">Require supervisor override</option>
            </select>
          </label>

          <label className="mt-3 inline-flex items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              name="geofenceAllowMissingLocation"
              defaultChecked={initialGeofenceAllowMissingLocation}
              className="h-4 w-4 rounded border-[color:var(--border-soft)] text-accent focus:ring-[color:var(--accent-primary)]"
            />
            Allow sign-ins when location capture is missing
          </label>

          <label className="mt-3 block text-sm text-secondary">
            Supervisor Override Code
            <input
              name="geofenceOverrideCode"
              type="password"
              autoComplete="new-password"
              placeholder={
                hasGeofenceOverrideCode
                  ? "Leave blank to keep current code"
                  : "Create override code"
              }
              className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm shadow-sm focus:border-[color:var(--accent-primary)] focus:ring-[color:var(--accent-primary)]"
            />
          </label>
          <label className="mt-2 inline-flex items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              name="clearGeofenceOverrideCode"
              className="h-4 w-4 rounded border-[color:var(--border-soft)] text-accent focus:ring-[color:var(--accent-primary)]"
            />
            Clear existing geofence override code
          </label>

          <div className="mt-4 rounded-md border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3">
            <h4 className="text-sm font-semibold text-accent">
              Mobile Geofence Automation
            </h4>
            <p className="mt-1 text-xs text-accent">
              `OFF`: no automation. `ASSIST`: app receives guidance only.
              `AUTO`: auto check-in/out where policy guardrails permit.
            </p>

            <label className="mt-3 block text-sm text-secondary">
              Automation mode
              <select
                name="geofenceAutomationMode"
                defaultValue={initialGeofenceAutomationMode}
                disabled={!canEnableMobileAssist}
                className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
              >
                <option value="OFF">OFF</option>
                <option value="ASSIST">ASSIST</option>
                <option value="AUTO">AUTO</option>
              </select>
            </label>

            <label className="mt-3 block text-sm text-secondary">
              Auto check-out grace (minutes)
              <input
                name="geofenceAutoCheckoutGraceMinutes"
                type="number"
                min={5}
                max={720}
                defaultValue={initialGeofenceAutoCheckoutGraceMinutes}
                disabled={!canEnableMobileAssist}
                className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-4">
          <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">
            Hardware Access Adapter
          </h3>
          <p className="mt-1 text-xs text-secondary">
            Sends access allow/deny decisions to your configured endpoint through
            the delivery queue.
          </p>

          <label className="mt-3 inline-flex items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              name="hardwareEnabled"
              defaultChecked={initialHardwareEnabled}
              disabled={!canEnableHardware}
              className="h-4 w-4 rounded border-[color:var(--border-soft)] text-accent focus:ring-[color:var(--accent-primary)] disabled:cursor-not-allowed"
            />
            Enable hardware access integration
          </label>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm text-secondary">
              Provider (optional)
              <input
                name="hardwareProvider"
                list="hardwareProviderOptions"
                defaultValue={initialHardwareProvider}
                placeholder="GENERIC or named connector"
                className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm shadow-sm focus:border-[color:var(--accent-primary)] focus:ring-[color:var(--accent-primary)]"
              />
              <datalist id="hardwareProviderOptions">
                <option value="GENERIC" />
                <option value="HID_ORIGO" />
                <option value="BRIVO" />
                <option value="GALLAGHER" />
                <option value="LENELS2" />
                <option value="GENETEC" />
              </datalist>
            </label>
            <label className="text-sm text-secondary">
              Endpoint URL
              <input
                name="hardwareEndpointUrl"
                type="url"
                defaultValue={initialHardwareEndpointUrl}
                placeholder="https://hardware.example.com/access-events"
                className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm shadow-sm focus:border-[color:var(--accent-primary)] focus:ring-[color:var(--accent-primary)]"
              />
            </label>
          </div>

          <label className="mt-3 block text-sm text-secondary">
            Hardware Auth Token (optional)
            <input
              name="hardwareAuthToken"
              type="password"
              autoComplete="new-password"
              minLength={12}
              placeholder={
                hasHardwareAuthToken
                  ? "Leave blank to keep current token"
                  : "Paste auth token"
              }
              className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm shadow-sm focus:border-[color:var(--accent-primary)] focus:ring-[color:var(--accent-primary)]"
            />
          </label>
          <label className="mt-2 inline-flex items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              name="clearHardwareAuthToken"
              className="h-4 w-4 rounded border-[color:var(--border-soft)] text-accent focus:ring-[color:var(--accent-primary)]"
            />
            Clear stored hardware auth token
          </label>
        </div>

        <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-4">
          <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">
            Visitor Photo + ID Evidence
          </h3>
          <p className="mt-1 text-xs text-secondary">
            Configure optional or required identity evidence capture during public sign-in.
          </p>

          <label className="mt-3 inline-flex items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              name="identityEnabled"
              defaultChecked={initialIdentityEnabled}
              disabled={!canEnableIdentityHardening}
              className="h-4 w-4 rounded border-[color:var(--border-soft)] text-accent focus:ring-[color:var(--accent-primary)] disabled:cursor-not-allowed"
            />
            Enable visitor identity evidence workflow
          </label>

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <label className="inline-flex items-center gap-2 text-sm text-secondary">
              <input
                type="checkbox"
                name="identityRequirePhoto"
                defaultChecked={initialIdentityRequirePhoto}
                disabled={!canEnableIdentityHardening}
                className="h-4 w-4 rounded border-[color:var(--border-soft)] text-accent focus:ring-[color:var(--accent-primary)] disabled:cursor-not-allowed"
              />
              Require visitor photo capture
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-secondary">
              <input
                type="checkbox"
                name="identityRequireIdScan"
                defaultChecked={initialIdentityRequireIdScan}
                disabled={!canEnableIdentityHardening}
                className="h-4 w-4 rounded border-[color:var(--border-soft)] text-accent focus:ring-[color:var(--accent-primary)] disabled:cursor-not-allowed"
              />
              Require visitor ID image upload
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-secondary md:col-span-2">
              <input
                type="checkbox"
                name="identityRequireConsent"
                defaultChecked={initialIdentityRequireConsent}
                disabled={!canEnableIdentityHardening}
                className="h-4 w-4 rounded border-[color:var(--border-soft)] text-accent focus:ring-[color:var(--accent-primary)] disabled:cursor-not-allowed"
              />
              Require explicit identity evidence consent
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-secondary md:col-span-2">
              <input
                type="checkbox"
                name="identityRequireOcrVerification"
                defaultChecked={initialIdentityRequireOcrVerification}
                disabled={!canEnableIdentityHardening || !canEnableIdentityOcr}
                className="h-4 w-4 rounded border-[color:var(--border-soft)] text-accent focus:ring-[color:var(--accent-primary)] disabled:cursor-not-allowed"
              />
              Require OCR verification against uploaded ID image
            </label>

            <label className="text-sm text-secondary md:col-span-2">
              OCR Decision Mode
              <select
                name="identityOcrDecisionMode"
                defaultValue={initialIdentityOcrDecisionMode}
                disabled={!canEnableIdentityHardening || !canEnableIdentityOcr}
                className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
              >
                <option value="assist">
                  Assist (records OCR evidence, does not block sign-in)
                </option>
                <option value="strict">
                  Strict (non-approved OCR requires manual review)
                </option>
              </select>
            </label>

            <label className="text-sm text-secondary md:col-span-2">
              Allowed ID Document Types (comma-separated)
              <input
                name="identityAllowedDocumentTypes"
                defaultValue={initialIdentityAllowedDocumentTypes.join(", ")}
                disabled={!canEnableIdentityHardening || !canEnableIdentityOcr}
                placeholder="DRIVER_LICENCE, PASSPORT"
                className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
              />
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary min-h-[42px]"
        >
          Save Access Controls
        </button>
      </form>
    </section>
  );
}


