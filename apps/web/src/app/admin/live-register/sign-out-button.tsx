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
  className?: string;
}

export function SignOutButton({
  signInId,
  visitorName,
  className = "",
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
      <div className="space-y-2 rounded-lg border border-red-400/35 bg-red-500/10 p-2">
        <p className="text-sm text-secondary">
          Sign out {visitorName}?
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSignOut}
            disabled={isPending}
            className="inline-flex min-h-[36px] items-center rounded-md border border-transparent bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "Working..." : "Yes, sign out"}
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            disabled={isPending}
            className="btn-secondary min-h-[36px] px-3 py-1.5 text-xs"
          >
            Cancel
          </button>
        </div>
        {error ? <span className="text-xs text-red-700">{error}</span> : null}
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className={`inline-flex min-h-[40px] items-center rounded-lg border border-red-400/45 bg-red-500/12 px-3 py-1.5 text-sm font-semibold text-red-900 transition-colors hover:bg-red-500/20 dark:text-red-100 ${className}`.trim()}
    >
      Sign Out
    </button>
  );
}
