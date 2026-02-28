import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserReadOnly } from "@/lib/auth";
import { RegisterForm } from "./register-form";

export const metadata = {
  title: "Create Account | InductLite",
};

export default async function RegisterPage() {
  const user = await getSessionUserReadOnly();
  if (user) {
    redirect(user.role === "ADMIN" ? "/admin/dashboard" : "/admin/sites");
  }

  return (
    <div className="kinetic-hover">
      <h2 className="kinetic-title mb-3 text-2xl font-black">
        Create your company workspace
      </h2>
      <p className="mb-6 text-sm text-secondary">
        Get a secure tenant environment running in minutes.
      </p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
