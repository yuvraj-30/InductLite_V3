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
    redirect("/admin/dashboard");
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        Sign in to your account
      </h2>

      <LoginForm />

      {/* Help text */}
      <div className="mt-6">
        <p className="text-center text-sm text-gray-500">
          Forgot your password?{" "}
          <a
            href="mailto:support@inductlite.co.nz"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
