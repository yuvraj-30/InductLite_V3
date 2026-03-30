"use client";

/**
 * Client-side action buttons for site management
 */

import { useTransition, useState } from "react";
import {
  deactivateSiteAction,
  reactivateSiteAction,
  rotatePublicLinkAction,
} from "./actions";

interface SiteButtonProps {
  siteId: string;
  siteName: string;
  className?: string;
  compact?: boolean;
}

interface SiteMutationButtonProps extends SiteButtonProps {
  action: (siteId: string) => Promise<{ success: boolean; error?: string }>;
  idleLabel: string;
  pendingLabel: string;
  confirmLabel: string;
  promptLabel: string;
  confirmContainerClassName: string;
  confirmButtonClassName: string;
  idleButtonClassName: string;
}

function SiteMutationButton({
  siteId,
  siteName,
  className = "",
  action,
  idleLabel,
  pendingLabel,
  confirmLabel,
  promptLabel,
  confirmContainerClassName,
  confirmButtonClassName,
  idleButtonClassName,
  compact = false,
}: SiteMutationButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await action(siteId);
      if (!result.success) {
        alert(result.error);
      }
      setShowConfirm(false);
    });
  };

  if (showConfirm) {
    return (
      <div className={confirmContainerClassName}>
        <span className={`block text-secondary ${compact ? "text-xs" : "text-sm"}`}>
          {promptLabel} &quot;{siteName}&quot;?
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className={confirmButtonClassName}
          >
            {isPending ? pendingLabel : confirmLabel}
          </button>
          <button
            type="button"
            onClick={() => setShowConfirm(false)}
            disabled={isPending}
            className={`btn-secondary ${compact ? "min-h-[34px] rounded-md px-2.5 py-1.5 text-xs" : "min-h-[36px] px-3 py-1.5 text-xs"}`}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShowConfirm(true)}
      className={`${idleButtonClassName} ${className}`.trim()}
    >
      {idleLabel}
    </button>
  );
}

export function ReactivateSiteButton({
  siteId,
  siteName,
  className = "",
  compact = false,
}: SiteButtonProps) {
  return (
    <SiteMutationButton
      siteId={siteId}
      siteName={siteName}
      className={className}
      action={reactivateSiteAction}
      idleLabel="Reactivate"
      pendingLabel="Working..."
      confirmLabel="Yes, reactivate"
      promptLabel="Reactivate"
      compact={compact}
      confirmContainerClassName={
        compact
          ? "space-y-1.5 rounded-lg border border-emerald-300/45 bg-[color:var(--bg-surface-strong)] p-2.5"
          : "space-y-2 rounded-lg border border-emerald-400/35 bg-emerald-500/10 p-2"
      }
      confirmButtonClassName={
        compact
          ? "inline-flex min-h-[34px] items-center rounded-md border border-transparent bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          : "inline-flex min-h-[36px] items-center rounded-md border border-transparent bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
      }
      idleButtonClassName={
        compact
          ? "inline-flex min-h-[34px] items-center justify-center rounded-md border border-emerald-300/55 bg-[color:var(--bg-surface)] px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50/80 dark:text-emerald-100"
          : "inline-flex min-h-[40px] items-center justify-center rounded-lg border border-emerald-400/45 bg-emerald-500/12 px-3 py-1.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-500/20 dark:text-emerald-100"
      }
    />
  );
}

export function DeactivateSiteButton({
  siteId,
  siteName,
  className = "",
  compact = false,
}: SiteButtonProps) {
  return (
    <SiteMutationButton
      siteId={siteId}
      siteName={siteName}
      className={className}
      action={deactivateSiteAction}
      idleLabel="Deactivate"
      pendingLabel="Working..."
      confirmLabel="Yes, deactivate"
      promptLabel="Deactivate"
      compact={compact}
      confirmContainerClassName={
        compact
          ? "space-y-1.5 rounded-lg border border-red-300/45 bg-[color:var(--bg-surface-strong)] p-2.5"
          : "space-y-2 rounded-lg border border-red-400/35 bg-red-500/10 p-2"
      }
      confirmButtonClassName={
        compact
          ? "inline-flex min-h-[34px] items-center rounded-md border border-transparent bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          : "inline-flex min-h-[36px] items-center rounded-md border border-transparent bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
      }
      idleButtonClassName={
        compact
          ? "inline-flex min-h-[34px] items-center justify-center rounded-md border border-red-300/55 bg-[color:var(--bg-surface)] px-2.5 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50/80 dark:text-red-100"
          : "inline-flex min-h-[40px] items-center justify-center rounded-lg border border-red-400/45 bg-red-500/12 px-3 py-1.5 text-sm font-semibold text-red-900 hover:bg-red-500/20 dark:text-red-100"
      }
    />
  );
}

interface RotateLinkButtonProps {
  siteId: string;
  onRotated?: (newSlug: string) => void;
}

export function RotateLinkButton({ siteId, onRotated }: RotateLinkButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleRotate = () => {
    startTransition(async () => {
      const result = await rotatePublicLinkAction(siteId);
      if (result.success) {
        setMessage("QR code link rotated! Old links will no longer work.");
        if (result.newSlug && onRotated) {
          onRotated(result.newSlug);
        }
        setTimeout(() => setMessage(null), 5000);
      } else {
        alert(result.error);
      }
      setShowConfirm(false);
    });
  };

  if (message) {
    return (
      <div className="text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-md">
        {message}
      </div>
    );
  }

  if (showConfirm) {
    return (
      <div className="flex items-center space-x-2 bg-yellow-50 px-3 py-2 rounded-md">
        <svg
          className="h-5 w-5 text-yellow-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span className="text-sm text-yellow-800">
          This will invalidate the current QR code. Continue?
        </span>
        <button
          type="button"
          onClick={handleRotate}
          disabled={isPending}
          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50"
        >
          {isPending ? "..." : "Yes, rotate"}
        </button>
        <button
          type="button"
          onClick={() => setShowConfirm(false)}
          disabled={isPending}
          className="btn-secondary min-h-[30px] px-2 py-1 text-xs"
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
      className="inline-flex items-center px-3 py-1.5 border border-yellow-300 shadow-sm text-sm font-medium rounded-md text-yellow-700 bg-[color:var(--bg-surface)] hover:bg-yellow-50"
    >
      <svg
        className="-ml-0.5 mr-1.5 h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      Rotate QR Link
    </button>
  );
}

