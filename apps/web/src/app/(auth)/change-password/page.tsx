import { redirect } from "next/navigation";
import { getSessionUserReadOnly } from "@/lib/auth";
import { ChangePasswordForm } from "./change-password-form";

/**
 * Change Password Page
 *
 * Requires authentication. Allows users to change their password.
 */
export default async function ChangePasswordPage() {
  // Require authentication
  const user = await getSessionUserReadOnly();
  if (!user) {
    redirect("/login");
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Change password
      </h2>

      <p className="text-sm text-gray-600 mb-6">Logged in as {user.email}</p>

      <ChangePasswordForm />

      <div className="mt-6 text-center">
        <a
          href="/admin/dashboard"
          className="text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
