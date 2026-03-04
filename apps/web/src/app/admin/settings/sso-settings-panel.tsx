"use client";

import { useActionState, useState, useTransition } from "react";
import {
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
    hasClientSecret: boolean;
    hasDirectorySyncToken: boolean;
  };
}

const initialState: SsoSettingsActionResult | null = null;

export default function SsoSettingsPanel({ initialConfig }: SsoSettingsPanelProps) {
  const [state, formAction] = useActionState(updateSsoSettingsAction, initialState);
  const [isRotating, startRotating] = useTransition();
  const [rotateResult, setRotateResult] =
    useState<RotateDirectorySyncKeyActionResult | null>(null);

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

  return (
    <section className="mb-6 rounded-lg border bg-white p-4">
      <h2 className="text-lg font-semibold text-gray-900">SSO and Directory Sync</h2>
      <p className="mt-1 text-sm text-gray-600">
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
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="enabled"
            value="true"
            defaultChecked={initialConfig.enabled}
            className="h-4 w-4 rounded border-gray-300"
          />
          Enable SSO login
        </label>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm text-gray-700">
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

          <label className="text-sm text-gray-700">
            Display name
            <input
              name="displayName"
              defaultValue={initialConfig.displayName}
              className="input mt-1"
              placeholder="Company SSO"
            />
          </label>

          <label className="text-sm text-gray-700">
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

          <label className="text-sm text-gray-700">
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

          <label className="text-sm text-gray-700 md:col-span-2">
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

          <label className="text-sm text-gray-700 md:col-span-2">
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

        <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-sm font-semibold text-gray-900">Role Mapping</h3>
          <p className="mt-1 text-xs text-gray-600">
            Match provider claims to app roles.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm text-gray-700">
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

            <label className="text-sm text-gray-700">
              Role claim path
              <input
                name="roleClaimPath"
                defaultValue={initialConfig.roleClaimPath}
                className="input mt-1"
                placeholder="roles"
              />
            </label>

            <label className="text-sm text-gray-700">
              Admin claim values
              <textarea
                name="roleMappingAdmin"
                rows={2}
                defaultValue={initialConfig.roleMapping.ADMIN.join(", ")}
                className="input mt-1"
              />
            </label>

            <label className="text-sm text-gray-700">
              Site manager claim values
              <textarea
                name="roleMappingSiteManager"
                rows={2}
                defaultValue={initialConfig.roleMapping.SITE_MANAGER.join(", ")}
                className="input mt-1"
              />
            </label>

            <label className="text-sm text-gray-700 md:col-span-2">
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

        <label className="block text-sm text-gray-700">
          Allowed email domains (optional)
          <textarea
            name="allowedEmailDomains"
            rows={2}
            defaultValue={initialConfig.allowedEmailDomains.join(", ")}
            className="input mt-1"
            placeholder="example.com"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="autoProvisionUsers"
            value="true"
            defaultChecked={initialConfig.autoProvisionUsers}
            className="h-4 w-4 rounded border-gray-300"
          />
          Auto-provision users on first successful SSO login
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="directorySyncEnabled"
            value="true"
            defaultChecked={initialConfig.directorySyncEnabled}
            className="h-4 w-4 rounded border-gray-300"
          />
          Enable directory sync API
        </label>

        <div className="flex items-center justify-end border-t pt-4">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save SSO Settings
          </button>
        </div>
      </form>

      <div className="mt-6 rounded-md border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Directory Sync API Key
        </h3>
        <p className="mt-1 text-xs text-gray-600">
          Endpoint:
          <code className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-[11px]">
            POST /api/auth/directory-sync?company=your-company-slug
          </code>
        </p>
        <p className="mt-1 text-xs text-gray-600">
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
            <div className="mt-2 rounded border border-green-200 bg-white p-2 font-mono text-xs text-gray-900">
              {rotateResult.apiKey}
            </div>
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleRotateToken}
            disabled={isRotating}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-50"
          >
            {isRotating ? "Rotating..." : "Rotate Directory Sync Key"}
          </button>
        </div>
      </div>
    </section>
  );
}
