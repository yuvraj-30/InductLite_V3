import { redirect } from "next/navigation";
import { getSessionUserReadOnly } from "@/lib/auth";
import Link from "next/link";
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
      <h2 className="kinetic-title mb-2 text-xl font-black text-[color:var(--text-primary)]">
        Change password
      </h2>

      <p className="mb-6 text-sm text-secondary">Logged in as {user.email}</p>

      <ChangePasswordForm />

      <div className="mt-6 text-center">
        <Link
          href="/admin/dashboard"
          className="btn-secondary min-h-[36px] px-3 py-1.5 text-xs"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
