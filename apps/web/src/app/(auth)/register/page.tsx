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
    <div>
      <h2 className="mb-6 text-xl font-semibold text-gray-900">
        Create your company workspace
      </h2>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
          Sign in
        </Link>
      </p>
    </div>
  );
}

