"use client";

import { useActionState, useState, useTransition } from "react";
import {
  rotatePartnerApiKeyAction,
  type RotatePartnerApiKeyActionResult,
  rotateDirectorySyncApiKeyAction,
  type RotateDirectorySyncKeyActionResult,
  updateSsoSettingsAction,
  type SsoSettingsActionResult,
} from "./actions";

interface SsoSettingsPanelProps {
  initialConfig: {
    enabled: boolean;
    provider: "OIDC_GENERIC" | "MICROSOFT_ENTRA";
    displayName: string;
    issuerUrl: string;
    clientId: string;
    scopes: string[];
    autoProvisionUsers: boolean;
    defaultRole: "ADMIN" | "SITE_MANAGER" | "VIEWER";
    roleClaimPath: string;
    roleMapping: {
      ADMIN: string[];
      SITE_MANAGER: string[];
      VIEWER: string[];
    };
    allowedEmailDomains: string[];
    directorySyncEnabled: boolean;
    partnerApiEnabled: boolean;
    partnerApiScopes: string[];
    partnerApiMonthlyQuota: number;
    hasClientSecret: boolean;
    hasDirectorySyncToken: boolean;
    hasPartnerApiToken: boolean;
  };
}

const initialState: SsoSettingsActionResult | null = null;

export default function SsoSettingsPanel({ initialConfig }: SsoSettingsPanelProps) {
  const [state, formAction] = useActionState(updateSsoSettingsAction, initialState);
  const [isRotating, startRotating] = useTransition();
  const [isRotatingPartner, startRotatingPartner] = useTransition();
  const [rotateResult, setRotateResult] =
    useState<RotateDirectorySyncKeyActionResult | null>(null);
  const [partnerRotateResult, setPartnerRotateResult] =
    useState<RotatePartnerApiKeyActionResult | null>(null);

  const getFieldError = (field: string): string | undefined => {
    if (state && !state.success && state.fieldErrors) {
      return state.fieldErrors[field]?.[0];
    }
    return undefined;
  };

  const handleRotateToken = () => {
    setRotateResult(null);
    startRotating(async () => {
      const result = await rotateDirectorySyncApiKeyAction();
      setRotateResult(result);
    });
  };

  const handleRotatePartnerToken = () => {
    setPartnerRotateResult(null);
    startRotatingPartner(async () => {
      const result = await rotatePartnerApiKeyAction();
      setPartnerRotateResult(result);
    });
  };

  return (
    <section className="surface-panel mb-6 p-4">
      <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">SSO and Directory Sync</h2>
      <p className="mt-1 text-sm text-secondary">
        Configure enterprise identity provider login and optional directory provisioning.
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
        <label className="flex items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            name="enabled"
            value="true"
            defaultChecked={initialConfig.enabled}
            className="h-4 w-4 rounded border-[color:var(--border-soft)]"
          />
          Enable SSO login
        </label>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm text-secondary">
            Provider
            <select
              name="provider"
              defaultValue={initialConfig.provider}
              className="input mt-1"
            >
              <option value="OIDC_GENERIC">Generic OIDC</option>
              <option value="MICROSOFT_ENTRA">Microsoft Entra ID</option>
            </select>
          </label>

          <label className="text-sm text-secondary">
            Display name
            <input
              name="displayName"
              defaultValue={initialConfig.displayName}
              className="input mt-1"
              placeholder="Company SSO"
            />
          </label>

          <label className="text-sm text-secondary">
            Issuer URL
            <input
              name="issuerUrl"
              defaultValue={initialConfig.issuerUrl}
              className="input mt-1"
              placeholder="https://login.microsoftonline.com/{tenant}/v2.0"
            />
            {getFieldError("issuerUrl") && (
              <p className="mt-1 text-xs text-red-600">{getFieldError("issuerUrl")}</p>
            )}
          </label>

          <label className="text-sm text-secondary">
            Client ID
            <input
              name="clientId"
              defaultValue={initialConfig.clientId}
              className="input mt-1"
            />
            {getFieldError("clientId") && (
              <p className="mt-1 text-xs text-red-600">{getFieldError("clientId")}</p>
            )}
          </label>

          <label className="text-sm text-secondary md:col-span-2">
            Client secret (leave blank to keep existing)
            <input
              name="clientSecret"
              type="password"
              autoComplete="new-password"
              className="input mt-1"
              placeholder={
                initialConfig.hasClientSecret
                  ? "Stored secret will be preserved"
                  : "No secret configured"
              }
            />
          </label>

          <label className="text-sm text-secondary md:col-span-2">
            Scopes (comma or newline separated)
            <textarea
              name="scopes"
              rows={2}
              defaultValue={initialConfig.scopes.join(", ")}
              className="input mt-1"
              placeholder="openid, profile, email"
            />
          </label>
        </div>

        <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-4">
          <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">Role Mapping</h3>
          <p className="mt-1 text-xs text-secondary">
            Match provider claims to app roles.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm text-secondary">
              Default role
              <select
                name="defaultRole"
                defaultValue={initialConfig.defaultRole}
                className="input mt-1"
              >
                <option value="ADMIN">Admin</option>
                <option value="SITE_MANAGER">Site manager</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </label>

            <label className="text-sm text-secondary">
              Role claim path
              <input
                name="roleClaimPath"
                defaultValue={initialConfig.roleClaimPath}
                className="input mt-1"
                placeholder="roles"
              />
            </label>

            <label className="text-sm text-secondary">
              Admin claim values
              <textarea
                name="roleMappingAdmin"
                rows={2}
                defaultValue={initialConfig.roleMapping.ADMIN.join(", ")}
                className="input mt-1"
              />
            </label>

            <label className="text-sm text-secondary">
              Site manager claim values
              <textarea
                name="roleMappingSiteManager"
                rows={2}
                defaultValue={initialConfig.roleMapping.SITE_MANAGER.join(", ")}
                className="input mt-1"
              />
            </label>

            <label className="text-sm text-secondary md:col-span-2">
              Viewer claim values
              <textarea
                name="roleMappingViewer"
                rows={2}
                defaultValue={initialConfig.roleMapping.VIEWER.join(", ")}
                className="input mt-1"
              />
            </label>
          </div>
        </div>

        <label className="block text-sm text-secondary">
          Allowed email domains (optional)
          <textarea
            name="allowedEmailDomains"
            rows={2}
            defaultValue={initialConfig.allowedEmailDomains.join(", ")}
            className="input mt-1"
            placeholder="example.com"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            name="autoProvisionUsers"
            value="true"
            defaultChecked={initialConfig.autoProvisionUsers}
            className="h-4 w-4 rounded border-[color:var(--border-soft)]"
          />
          Auto-provision users on first successful SSO login
        </label>

        <label className="flex items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            name="directorySyncEnabled"
            value="true"
            defaultChecked={initialConfig.directorySyncEnabled}
            className="h-4 w-4 rounded border-[color:var(--border-soft)]"
          />
          Enable directory sync API
        </label>

        <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-4">
          <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">Partner API v1</h3>
          <p className="mt-1 text-xs text-secondary">
            Configure versioned partner API access with scoped key permissions and monthly quotas.
          </p>

          <label className="mt-3 flex items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              name="partnerApiEnabled"
              value="true"
              defaultChecked={initialConfig.partnerApiEnabled}
              className="h-4 w-4 rounded border-[color:var(--border-soft)]"
            />
            Enable partner API
          </label>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm text-secondary md:col-span-2">
              API scopes (comma or newline separated)
              <textarea
                name="partnerApiScopes"
                rows={2}
                defaultValue={initialConfig.partnerApiScopes.join(", ")}
                className="input mt-1"
                placeholder="sites.read, signins.read"
              />
              {getFieldError("partnerApiScopes") && (
                <p className="mt-1 text-xs text-red-600">
                  {getFieldError("partnerApiScopes")}
                </p>
              )}
            </label>

            <label className="text-sm text-secondary">
              Monthly request quota
              <input
                name="partnerApiMonthlyQuota"
                type="number"
                min={100}
                max={1_000_000}
                defaultValue={initialConfig.partnerApiMonthlyQuota}
                className="input mt-1"
              />
              {getFieldError("partnerApiMonthlyQuota") && (
                <p className="mt-1 text-xs text-red-600">
                  {getFieldError("partnerApiMonthlyQuota")}
                </p>
              )}
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end border-t pt-4">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-[color:var(--accent-primary)] px-4 py-2 text-sm font-medium text-white hover:brightness-95"
          >
            Save SSO Settings
          </button>
        </div>
      </form>

      <div className="mt-6 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-4">
        <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">
          Directory Sync API Key
        </h3>
        <p className="mt-1 text-xs text-secondary">
          Endpoint:
          <code className="ml-1 rounded bg-[color:var(--bg-surface-strong)] px-1 py-0.5 text-[11px]">
            POST /api/auth/directory-sync?company=your-company-slug
          </code>
        </p>
        <p className="mt-1 text-xs text-secondary">
          Token status:{" "}
          <span className="font-medium">
            {initialConfig.hasDirectorySyncToken ? "Configured" : "Not configured"}
          </span>
        </p>

        {rotateResult && !rotateResult.success && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {rotateResult.error}
          </div>
        )}
        {rotateResult?.success && (
          <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <p>{rotateResult.message}</p>
            <p className="mt-1 text-xs">
              Copy this key now. It is only shown once.
            </p>
            <div className="mt-2 rounded border border-green-200 bg-[color:var(--bg-surface)] p-2 font-mono text-xs text-[color:var(--text-primary)]">
              {rotateResult.apiKey}
            </div>
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleRotateToken}
            disabled={isRotating}
            className="btn-secondary disabled:opacity-50"
          >
            {isRotating ? "Rotating..." : "Rotate Directory Sync Key"}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-4">
        <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">Partner API Key</h3>
        <p className="mt-1 text-xs text-secondary">
          Endpoints:
          <code className="ml-1 rounded bg-[color:var(--bg-surface-strong)] px-1 py-0.5 text-[11px]">
            GET /api/v1/partner/sites?company=your-company-slug
          </code>{" "}
          and
          <code className="ml-1 rounded bg-[color:var(--bg-surface-strong)] px-1 py-0.5 text-[11px]">
            GET /api/v1/partner/sign-ins?company=your-company-slug
          </code>
        </p>
        <p className="mt-1 text-xs text-secondary">
          Token status:{" "}
          <span className="font-medium">
            {initialConfig.hasPartnerApiToken ? "Configured" : "Not configured"}
          </span>
        </p>

        {partnerRotateResult && !partnerRotateResult.success && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {partnerRotateResult.error}
          </div>
        )}
        {partnerRotateResult?.success && (
          <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <p>{partnerRotateResult.message}</p>
            <p className="mt-1 text-xs">
              Copy this key now. It is only shown once.
            </p>
            <div className="mt-2 rounded border border-green-200 bg-[color:var(--bg-surface)] p-2 font-mono text-xs text-[color:var(--text-primary)]">
              {partnerRotateResult.apiKey}
            </div>
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleRotatePartnerToken}
            disabled={isRotatingPartner}
            className="btn-secondary disabled:opacity-50"
          >
            {isRotatingPartner ? "Rotating..." : "Rotate Partner API Key"}
          </button>
        </div>
      </div>
    </section>
  );
}


