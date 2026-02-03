"use client";

/**
 * Sign-Out Button Component
 *
 * Admin-only button to sign out a visitor.
 */

import { useState, useTransition } from "react";
import { adminSignOutAction } from "./actions";
import { isSuccess } from "@/lib/api";

interface SignOutButtonProps {
  signInId: string;
  visitorName: string;
}

export function SignOutButton({
  signInId,
  visitorName: _visitorName,
}: SignOutButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = () => {
    setError(null);
    startTransition(async () => {
      const result = await adminSignOutAction(signInId);
      if (!isSuccess(result)) {
        setError(result.error.message);
        setShowConfirm(false);
      }
    });
  };

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Confirm sign-out?</span>
        <button
          onClick={handleSignOut}
          disabled={isPending}
          className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
        >
          {isPending ? "..." : "Yes"}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isPending}
          className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
        >
          No
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="px-3 py-1 text-sm font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors"
    >
      Sign Out
    </button>
  );
}
