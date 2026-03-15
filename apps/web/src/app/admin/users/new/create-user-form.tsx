"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
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
        <Alert variant="error">{state.error}</Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Full Name" htmlFor="name" error={getFieldError("name")}>
          <input
            id="name"
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={120}
            className="input"
          />
        </Field>

        <Field label="Email" htmlFor="email" error={getFieldError("email")}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={160}
            className="input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Role" htmlFor="role" error={getFieldError("role")}>
          <select
            id="role"
            name="role"
            defaultValue="VIEWER"
            className="input"
          >
            <option value="ADMIN">ADMIN</option>
            <option value="SITE_MANAGER">SITE_MANAGER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
        </Field>

        <Field
          label="Temporary Password"
          htmlFor="password"
          hint="Must include uppercase, lowercase, and number."
          error={getFieldError("password")}
        >
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            className="input"
          />
        </Field>
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

