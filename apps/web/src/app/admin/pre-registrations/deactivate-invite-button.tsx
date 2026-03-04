"use client";

import { useState, useTransition } from "react";
import { deactivatePreRegistrationInviteAction } from "./actions";

interface DeactivateInviteButtonProps {
  inviteId: string;
  siteId: string;
}

export function DeactivateInviteButton({
  inviteId,
  siteId,
}: DeactivateInviteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDeactivate = () => {
    startTransition(async () => {
      const result = await deactivatePreRegistrationInviteAction(inviteId, siteId);
      if (!result.success) {
        alert(result.error);
      }
      setShowConfirm(false);
    });
  };

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDeactivate}
          disabled={isPending}
          className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          {isPending ? "..." : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setShowConfirm(false)}
          disabled={isPending}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShowConfirm(true)}
      className="rounded border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
    >
      Deactivate
    </button>
  );
}
