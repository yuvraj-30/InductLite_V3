"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createUserAction, type UserActionResult } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary"
    >
      {pending ? "Creating..." : "Create User"}
    </button>
  );
}

export default function CreateUserForm() {
  const initialState: UserActionResult | null = null;
  const router = useRouter();
  const [state, formAction] = useActionState(createUserAction, initialState);

  useEffect(() => {
    if (state?.success) {
      router.push("/admin/users");
    }
  }, [state, router]);

  const getFieldError = (field: string): string | undefined => {
    if (state && !state.success && state.fieldErrors) {
      return state.fieldErrors[field]?.[0];
    }
    return undefined;
  };

  return (
    <form action={formAction} className="space-y-6">
      {state && !state.success && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-secondary"
          >
            Full Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={120}
            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)]"
          />
          {getFieldError("name") && (
            <p className="mt-1 text-xs text-red-600">{getFieldError("name")}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-secondary"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={160}
            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)]"
          />
          {getFieldError("email") && (
            <p className="mt-1 text-xs text-red-600">{getFieldError("email")}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor="role"
            className="block text-sm font-medium text-secondary"
          >
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue="VIEWER"
            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)]"
          >
            <option value="ADMIN">ADMIN</option>
            <option value="SITE_MANAGER">SITE_MANAGER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
          {getFieldError("role") && (
            <p className="mt-1 text-xs text-red-600">{getFieldError("role")}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-secondary"
          >
            Temporary Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)]"
          />
          <p className="mt-1 text-xs text-muted">
            Must include uppercase, lowercase, and number.
          </p>
          {getFieldError("password") && (
            <p className="mt-1 text-xs text-red-600">
              {getFieldError("password")}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <Link
          href="/admin/users"
          className="btn-secondary"
        >
          Cancel
        </Link>
        <SubmitButton />
      </div>
    </form>
  );
}

