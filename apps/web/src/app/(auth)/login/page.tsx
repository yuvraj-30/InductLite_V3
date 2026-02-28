import { redirect } from "next/navigation";
import { getSessionUserReadOnly } from "@/lib/auth";
import { LoginForm } from "./login-form";

/**
 * Login Page
 *
 * Server component that renders the login page.
 * Redirects to admin if already authenticated.
 */
export default async function LoginPage() {
  // Check if already authenticated (read-only, no cookie writes)
  const user = await getSessionUserReadOnly();
  if (user) {
    // Avoid redirecting non-admin roles into an unauthorized loop.
    redirect(user.role === "ADMIN" ? "/admin/dashboard" : "/admin/sites");
  }

  return (
    <div className="kinetic-hover">
      <h2 className="kinetic-title mb-3 text-2xl font-black">
        Sign in to your account
      </h2>
      <p className="mb-6 text-sm text-secondary">
        Secure access for tenant-scoped admin operations.
      </p>

      <LoginForm />

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
