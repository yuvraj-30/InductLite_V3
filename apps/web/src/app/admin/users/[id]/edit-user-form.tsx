"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { type UserRole } from "@prisma/client";
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
}: {
  user: UserFormModel;
  isCurrentUser: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <>
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
            defaultValue={user.name}
            required
            minLength={2}
            maxLength={120}
            disabled={pending}
            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          />
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
            defaultValue={user.email}
            required
            maxLength={160}
            disabled={pending}
            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          />
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
            defaultValue={user.role}
            disabled={pending || isCurrentUser}
            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          >
            <option value="ADMIN">ADMIN</option>
            <option value="SITE_MANAGER">SITE_MANAGER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
          {isCurrentUser && (
            <p className="mt-1 text-xs text-muted">
              You cannot change your own role.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="newPassword"
            className="block text-sm font-medium text-secondary"
          >
            New Password (optional)
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            disabled={pending}
            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          />
        </div>
      </div>

      <div className="rounded-md border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3 text-sm text-secondary">
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
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}

      {state?.success && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3">
          <p className="text-sm text-green-700">{state.message}</p>
        </div>
      )}

      <FormFields user={user} isCurrentUser={isCurrentUser} />

      {!state?.success && (
        <div className="grid grid-cols-1 gap-1 text-xs text-red-600">
          {getFieldError("name") && <p>{getFieldError("name")}</p>}
          {getFieldError("email") && <p>{getFieldError("email")}</p>}
          {getFieldError("role") && <p>{getFieldError("role")}</p>}
          {getFieldError("newPassword") && <p>{getFieldError("newPassword")}</p>}
        </div>
      )}
    </form>
  );
}
