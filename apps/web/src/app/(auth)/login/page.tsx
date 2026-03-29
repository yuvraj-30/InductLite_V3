import dynamic from "next/dynamic";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { PublicSignalCard } from "@/components/ui/public-signal-card";
import { getSessionUserReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { LoginForm } from "./login-form";
import type { LoginIntentMode } from "./login-intent-selector";

const LoginIntentSelector = dynamic(
  () =>
    import("./login-intent-selector").then((mod) => ({
      default: mod.LoginIntentSelector,
    })),
  {
    loading: () => (
      <div className="surface-panel rounded-2xl border border-[color:var(--border-soft)] p-4 text-sm text-secondary">
        Loading sign-in methods...
      </div>
    ),
  },
);

interface LoginPageProps {
  searchParams?: Promise<{
    company?: string | string[];
    sso?: string | string[];
  }>;
}

function toFirstString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function mapSsoStatusMessage(code: string): string | null {
  switch (code) {
    case "missing_workspace":
      return "Enter your workspace slug to continue with SSO.";
    case "workspace_not_found":
      return "Workspace not found. Check your workspace slug and try again.";
    case "not_configured":
      return "SSO is not configured for this workspace.";
    case "state_invalid":
      return "Your SSO session expired. Start again.";
    case "provider_error":
      return "Your identity provider did not complete login.";
    case "start_failed":
      return "Unable to start SSO right now. Try again.";
    case "callback_failed":
      return "SSO login failed. Check your account mapping and try again.";
    case "session_missing":
      return "Your session was not found. Start the SSO login again.";
    default:
      return null;
  }
}

function getDefaultIntentMode(params: {
  companySlug: string;
  ssoStatus: string;
}): LoginIntentMode {
  if (params.companySlug.length > 0) {
    return "sso";
  }

  if (params.ssoStatus.length > 0) {
    return "sso";
  }

  return "password";
}

/**
 * Login Page
 *
 * Server component that renders the login page.
 * Redirects to admin if already authenticated.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Check if already authenticated (read-only, no cookie writes)
  const user = await getSessionUserReadOnly();
  if (user) {
    // Avoid redirecting non-admin roles into an unauthorized loop.
    redirect(user.role === "ADMIN" ? "/admin/dashboard" : "/admin/sites");
  }
  const params = (await searchParams) ?? {};
  const companySlug = toFirstString(params.company).trim().toLowerCase();
  const ssoStatus = toFirstString(params.sso);
  const ssoMessage = mapSsoStatusMessage(ssoStatus);
  const splitIntentEnabled = isFeatureEnabled("UIX_S2_FLOW");
  const defaultIntent = getDefaultIntentMode({ companySlug, ssoStatus });

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">
          Workspace sign-in
        </span>
        <div className="kinetic-hover">
          <h2 className="kinetic-title text-3xl font-black">
            Sign in without losing context.
          </h2>
          <p className="mt-3 max-w-xl text-sm text-secondary sm:text-base">
            Return to live operations, inductions, and records from the same
            product your teams use at the gate.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <PublicSignalCard
            eyebrow="Site operations"
            title="Move straight into live registers, sites, and approvals."
          />
          <PublicSignalCard
            eyebrow="Protected access"
            title="Tenant-scoped auth and MFA-aware login paths stay intact."
          />
          <PublicSignalCard
            eyebrow="Clear next step"
            title="Choose password or SSO based on how your workspace is set up."
          />
        </div>
      </div>

      {splitIntentEnabled ? (
        <LoginIntentSelector
          defaultMode={defaultIntent}
          companySlug={companySlug}
          ssoMessage={ssoMessage}
        />
      ) : (
        <>
          <LoginForm />

          <div className="my-6 space-y-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4">
            <div>
              <h3 className="text-sm font-semibold text-primary">Single sign-on</h3>
              <p className="mt-1 text-xs text-secondary">
                Use your company identity provider when your workspace is set up
                for SSO.
              </p>
            </div>

            {ssoMessage && (
              <Alert variant="error" title="SSO needs attention">
                {ssoMessage}
              </Alert>
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
        </>
      )}

      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-4 py-4 text-sm text-secondary">
        <p className="text-center text-sm text-secondary">
          New to InductLite?{" "}
          <Link href="/register" className="font-semibold text-accent hover:underline">
            Create your workspace
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-muted">
          Need access help?{" "}
          <a
            href="mailto:support@inductlite.nz"
            className="font-semibold text-accent hover:underline"
          >
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
