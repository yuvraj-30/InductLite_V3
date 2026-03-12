"use client";

import { useState, useTransition } from "react";
import {
  deactivateUserAction,
  reactivateUserAction,
  purgeUserAction,
} from "./actions";

interface UserActionButtonsProps {
  userId: string;
  userName: string;
  isActive: boolean;
  isCurrentUser: boolean;
}

export function UserActionButtons({
  userId,
  userName,
  isActive,
  isCurrentUser,
}: UserActionButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<"toggle" | "purge" | null>(
    null,
  );

  if (isCurrentUser) {
    return <span className="text-sm text-secondary">Current account</span>;
  }

  const handleToggle = () => {
    startTransition(async () => {
      const result = isActive
        ? await deactivateUserAction(userId)
        : await reactivateUserAction(userId);

      if (!result.success) {
        alert(result.error);
      }
      setConfirmAction(null);
    });
  };

  const handlePurge = () => {
    startTransition(async () => {
      const result = await purgeUserAction(userId);

      if (!result.success) {
        alert(result.error);
      }
      setConfirmAction(null);
    });
  };

  if (confirmAction) {
    const isPurge = confirmAction === "purge";

    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-secondary">
          {isPurge
            ? `Delete ${userName} permanently?`
            : `${isActive ? "Deactivate" : "Reactivate"} ${userName}?`}
        </span>
        <button
          type="button"
          onClick={isPurge ? handlePurge : handleToggle}
          disabled={isPending}
          className={`inline-flex min-h-[36px] items-center rounded px-2.5 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
            isPurge || isActive
              ? "bg-red-600 hover:bg-red-700"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isPending ? "..." : "Yes"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmAction(null)}
          disabled={isPending}
          className="btn-secondary min-h-[36px] px-2.5 py-1.5 text-sm"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setConfirmAction("toggle")}
        className={`inline-flex min-h-[36px] items-center rounded-md border px-2.5 py-1.5 text-sm font-medium ${
          isActive
            ? "border-red-300 text-red-700 hover:bg-red-50"
            : "border-green-300 text-green-700 hover:bg-green-50"
        }`}
      >
        {isActive ? "Deactivate" : "Reactivate"}
      </button>
      {!isActive && (
        <button
          type="button"
          onClick={() => setConfirmAction("purge")}
          className="inline-flex min-h-[36px] items-center rounded-md border border-red-300 px-2.5 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Delete
        </button>
      )}
    </div>
  );
}
