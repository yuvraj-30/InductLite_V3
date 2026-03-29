"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { LoginForm } from "./login-form";

export type LoginIntentMode = "password" | "sso";

interface LoginIntentSelectorProps {
  defaultMode: LoginIntentMode;
  companySlug: string;
  ssoMessage: string | null;
}

type IntentOption = {
  id: LoginIntentMode;
  title: string;
  description: string;
  support: string;
};

const INTENT_OPTIONS: IntentOption[] = [
  {
    id: "password",
    title: "Password",
    description: "Best for day-to-day operator access from a trusted device.",
    support: "Email, password, and MFA when required.",
  },
  {
    id: "sso",
    title: "Single sign-on",
    description: "Use your company identity provider to keep workspace access aligned.",
    support: "OIDC and Entra-connected workspace access.",
  },
];

function intentButtonClass(isActive: boolean): string {
  if (isActive) {
    return "border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)] shadow-soft";
  }

  return "border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--bg-surface-strong)]";
}

function SsoForm({
  companySlug,
  ssoMessage,
}: {
  companySlug: string;
  ssoMessage: string | null;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
          Workspace identity provider
        </p>
        <p className="mt-2 text-sm text-secondary">
          Enter your workspace slug and continue through your company&apos;s
          SSO provider.
        </p>
      </div>

      {ssoMessage ? (
        <Alert variant="error" title="SSO needs attention">
          {ssoMessage}
        </Alert>
      ) : null}

      <form action="/api/auth/sso/start" method="get" className="space-y-4">
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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
              Choose sign-in method
            </p>
            <p className="mt-2 text-sm text-secondary">
              Pick the fastest approved path back into your workspace.
            </p>
          </div>
          <p className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">
            Tenant-scoped access
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {INTENT_OPTIONS.map((option) => {
            const active = mode === option.id;

            return (
              <button
                key={option.id}
                type="button"
                className={`rounded-2xl border p-4 text-left transition ${intentButtonClass(active)}`}
                onClick={() => setMode(option.id)}
                aria-pressed={active}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                    {option.title}
                  </p>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                      active
                        ? "bg-[color:var(--accent-primary)] text-white"
                        : "border border-[color:var(--border-soft)] text-secondary"
                    }`}
                  >
                    {active ? "Selected" : "Available"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-secondary">{option.description}</p>
                <p className="mt-3 text-xs text-muted">{option.support}</p>
              </button>
            );
          })}
        </div>
      </div>

      {mode === "password" ? (
        <LoginForm />
      ) : (
        <SsoForm companySlug={companySlug} ssoMessage={ssoMessage} />
      )}
    </div>
  );
}
