import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
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
      <div className="surface-panel rounded-xl border border-[color:var(--border-soft)] p-4 text-sm text-secondary">
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
    <div className="kinetic-hover">
      <h2 className="kinetic-title mb-3 text-2xl font-black">
        Sign in to your account
      </h2>
      <p className="mb-6 text-sm text-secondary">
        Secure access for tenant-scoped admin operations.
      </p>

      {splitIntentEnabled ? (
        <LoginIntentSelector
          defaultMode={defaultIntent}
          companySlug={companySlug}
          ssoMessage={ssoMessage}
        />
      ) : (
        <>
          <LoginForm />

          <div className="my-6 border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-primary">Single Sign-On</h3>
            <p className="mt-1 text-xs text-secondary">
              Use your company identity provider (OIDC/Entra).
            </p>

            {ssoMessage && (
              <div
                className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                role="alert"
              >
                {ssoMessage}
              </div>
            )}

            <form action="/api/auth/sso/start" method="get" className="mt-4 space-y-3">
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

      <div className="mt-6 space-y-2">
        <p className="text-center text-sm text-secondary">
          New to InductLite?{" "}
          <a
            href="/register"
            className="font-semibold text-accent hover:underline"
          >
            Create your workspace
          </a>
        </p>
        <p className="text-center text-sm text-muted">
          Forgot your password?{" "}
          <a
            href="mailto:support@inductlite.co.nz"
            className="font-semibold text-accent hover:underline"
          >
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
