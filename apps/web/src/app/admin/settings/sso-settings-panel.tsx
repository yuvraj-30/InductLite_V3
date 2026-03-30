"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { AdminDisclosureSection } from "@/components/ui/admin-disclosure-section";
import { Alert } from "@/components/ui/alert";
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

function SaveSsoButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary"
    >
      {pending ? "Saving..." : "Save SSO Settings"}
    </button>
  );
}

export default function SsoSettingsPanel({ initialConfig }: SsoSettingsPanelProps) {
  const [state, formAction] = useActionState(updateSsoSettingsAction, initialState);
  const [isRotating, startRotating] = useTransition();
  const [isRotatingPartner, startRotatingPartner] = useTransition();
  const persistedDefaultRole =
    state?.success ? state.savedConfig.defaultRole : initialConfig.defaultRole;
  const [defaultRoleValue, setDefaultRoleValue] = useState<
    SsoSettingsPanelProps["initialConfig"]["defaultRole"]
  >(persistedDefaultRole);
  const [rotateResult, setRotateResult] =
    useState<RotateDirectorySyncKeyActionResult | null>(null);
  const [partnerRotateResult, setPartnerRotateResult] =
    useState<RotatePartnerApiKeyActionResult | null>(null);

  useEffect(() => {
    setDefaultRoleValue(persistedDefaultRole);
  }, [persistedDefaultRole]);

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
  const accessSectionOpen =
    initialConfig.enabled ||
    Boolean(getFieldError("enabled")) ||
    Boolean(getFieldError("issuerUrl")) ||
    Boolean(getFieldError("clientId")) ||
    Boolean(getFieldError("clientSecret"));
  const provisioningSectionOpen =
    initialConfig.autoProvisionUsers ||
    initialConfig.allowedEmailDomains.length > 0 ||
    Boolean(getFieldError("roleClaimPath")) ||
    Boolean(getFieldError("allowedEmailDomains"));
  const externalSyncSectionOpen =
    initialConfig.directorySyncEnabled ||
    initialConfig.partnerApiEnabled ||
    Boolean(getFieldError("partnerApiScopes")) ||
    Boolean(getFieldError("partnerApiMonthlyQuota"));

  return (
    <section className="surface-panel p-4">
      <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">SSO and Directory Sync</h2>
      <p className="mt-1 text-sm text-secondary">
        Configure enterprise login, access mapping, and external keys without letting the lower half of settings turn into one long form.
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
        <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[color:var(--text-primary)]">
              Identity controls stay compact until you open the part you need.
            </p>
            <p className="mt-1 text-xs text-secondary">
              Save access changes from the top row without reopening every disclosure.
            </p>
          </div>
          <SaveSsoButton />
        </div>

        <AdminDisclosureSection
          eyebrow="Access"
          title="SSO provider setup"
          description="Keep the provider connection and base sign-in settings visible without leaving every field open."
          summaryMeta={
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
              {initialConfig.enabled ? "SSO enabled" : "Password only"}
            </span>
          }
          titleAs="h3"
          defaultOpen={accessSectionOpen}
          tone="subtle"
        >
          <label className="flex items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              name="enabled"
              value="true"
              defaultChecked={initialConfig.enabled}
              className="check-control"
            />
            Enable SSO login
          </label>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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
                autoComplete="organization"
                className="input mt-1"
                placeholder="Company SSO"
              />
            </label>

            <label className="text-sm text-secondary">
              Issuer URL
              <input
                name="issuerUrl"
                defaultValue={initialConfig.issuerUrl}
                autoComplete="url"
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
                autoComplete="off"
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
                autoComplete="off"
                className="input mt-1"
                placeholder="openid, profile, email"
              />
            </label>
          </div>
        </AdminDisclosureSection>

        <AdminDisclosureSection
          eyebrow="Provisioning"
          title="Role mapping and access policy"
          description="Keep claim mapping, domain restrictions, and default roles grouped together instead of spreading them through the whole form."
          summaryMeta={
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
              {initialConfig.autoProvisionUsers ? "Auto-provision on" : "Manual user creation"}
            </span>
          }
          titleAs="h3"
          defaultOpen={provisioningSectionOpen}
          tone="subtle"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm text-secondary">
              Default role
              <select
                name="defaultRole"
                value={defaultRoleValue}
                onChange={(event) =>
                  setDefaultRoleValue(
                    event.currentTarget.value as SsoSettingsPanelProps["initialConfig"]["defaultRole"],
                  )
                }
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
                autoComplete="off"
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
                autoComplete="off"
                className="input mt-1"
              />
            </label>

            <label className="text-sm text-secondary">
              Site manager claim values
              <textarea
                name="roleMappingSiteManager"
                rows={2}
                defaultValue={initialConfig.roleMapping.SITE_MANAGER.join(", ")}
                autoComplete="off"
                className="input mt-1"
              />
            </label>

            <label className="text-sm text-secondary md:col-span-2">
              Viewer claim values
              <textarea
                name="roleMappingViewer"
                rows={2}
                defaultValue={initialConfig.roleMapping.VIEWER.join(", ")}
                autoComplete="off"
                className="input mt-1"
              />
            </label>
          </div>

          <label className="mt-4 block text-sm text-secondary">
            Allowed email domains (optional)
            <textarea
              name="allowedEmailDomains"
              rows={2}
              defaultValue={initialConfig.allowedEmailDomains.join(", ")}
              autoComplete="off"
              className="input mt-1"
              placeholder="example.com"
            />
          </label>

          <label className="mt-4 flex items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              name="autoProvisionUsers"
              value="true"
              defaultChecked={initialConfig.autoProvisionUsers}
              className="check-control"
            />
            Auto-provision users on first successful SSO login
          </label>
        </AdminDisclosureSection>

        <AdminDisclosureSection
          eyebrow="External sync"
          title="Directory sync and partner API"
          description="Keep downstream provisioning and versioned API access behind one calmer disclosure."
          summaryMeta={
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
              {initialConfig.directorySyncEnabled || initialConfig.partnerApiEnabled
                ? "External access on"
                : "External access off"}
            </span>
          }
          titleAs="h3"
          defaultOpen={externalSyncSectionOpen}
          tone="subtle"
        >
          <label className="flex items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              name="directorySyncEnabled"
              value="true"
              defaultChecked={initialConfig.directorySyncEnabled}
              className="check-control"
            />
            Enable directory sync API
          </label>

          <div className="mt-4 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-4">
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
                className="check-control"
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
                  autoComplete="off"
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
                  autoComplete="off"
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
        </AdminDisclosureSection>

      </form>

      <div className="mt-6 space-y-4">
        <AdminDisclosureSection
          eyebrow="Credentials"
          title="Directory sync API key"
          description="Rotate the directory sync key only when an external connector actually needs it."
          summaryMeta={
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
              {initialConfig.hasDirectorySyncToken ? "Configured" : "Not configured"}
            </span>
          }
          titleAs="h3"
          tone="subtle"
        >
          <p className="text-xs text-secondary">
            Endpoint:
            <code className="ml-1 rounded bg-[color:var(--bg-surface)] px-1 py-0.5 text-[11px]">
              POST /api/auth/directory-sync?company=your-company-slug
            </code>
          </p>

          {rotateResult && !rotateResult.success && (
            <Alert variant="error" className="mt-3">
              {rotateResult.error}
            </Alert>
          )}
          {rotateResult?.success && (
            <Alert variant="success" className="mt-3">
              <p>{rotateResult.message}</p>
              <p className="mt-1 text-xs">
                Copy this key now. It is only shown once.
              </p>
              <div className="mt-2 rounded border border-green-200 bg-[color:var(--bg-surface)] p-2 font-mono text-xs text-[color:var(--text-primary)]">
                {rotateResult.apiKey}
              </div>
            </Alert>
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
        </AdminDisclosureSection>

        <AdminDisclosureSection
          eyebrow="Credentials"
          title="Partner API key"
          description="Keep partner-read access versioned and scoped without forcing the credential block open all the time."
          summaryMeta={
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
              {initialConfig.hasPartnerApiToken ? "Configured" : "Not configured"}
            </span>
          }
          titleAs="h3"
          tone="subtle"
        >
          <p className="text-xs text-secondary">
            Endpoints:
            <code className="ml-1 rounded bg-[color:var(--bg-surface)] px-1 py-0.5 text-[11px]">
              GET /api/v1/partner/sites?company=your-company-slug
            </code>{" "}
            and
            <code className="ml-1 rounded bg-[color:var(--bg-surface)] px-1 py-0.5 text-[11px]">
              GET /api/v1/partner/sign-ins?company=your-company-slug
            </code>
          </p>

          {partnerRotateResult && !partnerRotateResult.success && (
            <Alert variant="error" className="mt-3">
              {partnerRotateResult.error}
            </Alert>
          )}
          {partnerRotateResult?.success && (
            <Alert variant="success" className="mt-3">
              <p>{partnerRotateResult.message}</p>
              <p className="mt-1 text-xs">
                Copy this key now. It is only shown once.
              </p>
              <div className="mt-2 rounded border border-green-200 bg-[color:var(--bg-surface)] p-2 font-mono text-xs text-[color:var(--text-primary)]">
                {partnerRotateResult.apiKey}
              </div>
            </Alert>
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
        </AdminDisclosureSection>
      </div>
    </section>
  );
}


