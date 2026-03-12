"use client";

import { useMemo, useState } from "react";
import { LoginForm } from "./login-form";

export type LoginIntentMode = "password" | "sso";

interface LoginIntentSelectorProps {
  defaultMode: LoginIntentMode;
  companySlug: string;
  ssoMessage: string | null;
}

function intentButtonClass(isActive: boolean): string {
  if (isActive) {
    return "border-accent bg-accent/10 text-primary";
  }

  return "border-border bg-[color:var(--bg-surface)] text-secondary hover:border-accent/60 hover:text-primary";
}

function SsoForm({
  companySlug,
  ssoMessage,
}: {
  companySlug: string;
  ssoMessage: string | null;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-secondary">
        Use your company identity provider (OIDC/Entra).
      </p>

      {ssoMessage && (
        <div
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {ssoMessage}
        </div>
      )}

      <form action="/api/auth/sso/start" method="get" className="space-y-3">
        <div>
          <label htmlFor="company" className="label">
            Workspace slug
          </label>
          <input
            id="company"
            name="company"
            type="text"
            required
            defaultValue={companySlug}
            className="input mt-1"
            placeholder="your-company-slug"
          />
        </div>
        <button type="submit" className="btn-secondary w-full">
          Continue with SSO
        </button>
      </form>
    </div>
  );
}

export function LoginIntentSelector({
  defaultMode,
  companySlug,
  ssoMessage,
}: LoginIntentSelectorProps) {
  const [mode, setMode] = useState<LoginIntentMode>(defaultMode);

  const activeDescription = useMemo(() => {
    if (mode === "password") {
      return "Email and password access for workspace admins.";
    }

    return "Single sign-on through your company identity provider.";
  }, [mode]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-[color:var(--bg-surface)] p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
          Choose Sign-In Method
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${intentButtonClass(mode === "password")}`}
            onClick={() => setMode("password")}
            aria-pressed={mode === "password"}
          >
            Password
          </button>
          <button
            type="button"
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${intentButtonClass(mode === "sso")}`}
            onClick={() => setMode("sso")}
            aria-pressed={mode === "sso"}
          >
            SSO
          </button>
        </div>
        <p className="mt-3 text-xs text-secondary">{activeDescription}</p>
      </div>

      {mode === "password" ? (
        <LoginForm />
      ) : (
        <SsoForm companySlug={companySlug} ssoMessage={ssoMessage} />
      )}
    </div>
  );
}
