"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { type UserRole } from "@prisma/client";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { updateUserAction, type UserActionResult } from "../actions";
import { UserActionButtons } from "../user-action-buttons";

interface UserFormModel {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  last_login_at: Date | null;
}

interface EditUserFormProps {
  user: UserFormModel;
  isCurrentUser: boolean;
}

const initialState: UserActionResult | null = null;

function FormFields({
  user,
  isCurrentUser,
  getFieldError,
}: {
  user: UserFormModel;
  isCurrentUser: boolean;
  getFieldError: (field: string) => string | undefined;
}) {
  const { pending } = useFormStatus();

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Full Name" htmlFor="name" error={getFieldError("name")}>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={user.name}
            required
            minLength={2}
            maxLength={120}
            disabled={pending}
            className="input disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          />
        </Field>

        <Field label="Email" htmlFor="email" error={getFieldError("email")}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            defaultValue={user.email}
            required
            maxLength={160}
            disabled={pending}
            className="input disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          label="Role"
          htmlFor="role"
          hint={isCurrentUser ? "You cannot change your own role." : undefined}
          error={getFieldError("role")}
        >
          <select
            id="role"
            name="role"
            defaultValue={user.role}
            disabled={pending || isCurrentUser}
            className="input disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          >
            <option value="ADMIN">ADMIN</option>
            <option value="SITE_MANAGER">SITE_MANAGER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
        </Field>

        <Field
          label="New Password (optional)"
          htmlFor="newPassword"
          error={getFieldError("newPassword")}
        >
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            disabled={pending}
            className="input disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          />
        </Field>
      </div>

      <div className="field-note">
        <p>
          Status:{" "}
          <span className="font-medium">
            {user.is_active ? "Active" : "Inactive"}
          </span>
        </p>
        <p>
          Last Login:{" "}
          <span className="font-medium">
            {user.last_login_at
              ? user.last_login_at.toLocaleString("en-NZ")
              : "Never"}
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {!isCurrentUser && (
          <UserActionButtons
            userId={user.id}
            userName={user.name}
            isActive={user.is_active}
            isCurrentUser={isCurrentUser}
          />
        )}
        <button
          type="submit"
          disabled={pending}
          className="btn-primary"
        >
          {pending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </>
  );
}

export function EditUserForm({ user, isCurrentUser }: EditUserFormProps) {
  const boundAction = updateUserAction.bind(null, user.id);
  const [state, formAction] = useActionState(boundAction, initialState);

  const getFieldError = (field: string): string | undefined => {
    if (state && !state.success && state.fieldErrors) {
      return state.fieldErrors[field]?.[0];
    }
    return undefined;
  };

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <Alert variant="error">{state.error}</Alert>
      )}

      {state?.success && (
        <Alert variant="success">{state.message}</Alert>
      )}

      <FormFields
        user={user}
        isCurrentUser={isCurrentUser}
        getFieldError={getFieldError}
      />
    </form>
  );
}
