import Link from "next/link";
import type { ReactNode } from "react";
import { isFeatureEnabled } from "@/lib/feature-flags";

interface PageEmptyStateProps {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  icon?: ReactNode;
  children?: ReactNode;
}

interface PageWarningStateProps {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}

function DefaultEmptyIcon() {
  return (
    <svg
      className="mx-auto h-12 w-12 text-muted"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

export function PageEmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  icon,
  children,
}: PageEmptyStateProps) {
  const flowEnabled = isFeatureEnabled("UIX_S2_FLOW");

  if (!flowEnabled) {
    return (
      <div className="surface-panel p-8 text-center">
        <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">{title}</h3>
        <p className="mt-2 text-sm text-secondary">{description}</p>
        {actionHref && actionLabel ? (
          <div className="mt-4">
            <Link href={actionHref} className="btn-secondary">
              {actionLabel}
            </Link>
          </div>
        ) : null}
        {children ? <div className="mt-4 text-left">{children}</div> : null}
      </div>
    );
  }

  return (
    <div className="surface-panel p-8 text-center">
      <div className="mb-4">{icon ?? <DefaultEmptyIcon />}</div>
      <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">{title}</h3>
      <p className="mt-2 text-sm text-secondary">{description}</p>
      {actionHref && actionLabel ? (
        <div className="mt-6">
          <Link href={actionHref} className="btn-primary">
            {actionLabel}
          </Link>
        </div>
      ) : null}
      {children ? <div className="mt-6 text-left">{children}</div> : null}
    </div>
  );
}

export function PageWarningState({
  title,
  description,
  actionHref,
  actionLabel,
}: PageWarningStateProps) {
  const flowEnabled = isFeatureEnabled("UIX_S2_FLOW");

  if (!flowEnabled) {
    return (
      <div className="rounded-xl border border-amber-400/45 bg-amber-100/70 p-4 dark:bg-amber-950/45">
        <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
          {title}
        </p>
        <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">{description}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-400/45 bg-amber-100/70 p-4 dark:bg-amber-950/45">
      <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
        {title}
      </h2>
      <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
        {description}
      </p>
      {actionHref && actionLabel ? (
        <div className="mt-3">
          <Link href={actionHref} className="text-sm font-semibold text-accent hover:underline">
            {actionLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function PageLoadingState({
  title = "Loading workspace data",
  description = "Fetching the latest records for your current filters.",
}: {
  title?: string;
  description?: string;
}) {
  const flowEnabled = isFeatureEnabled("UIX_S2_FLOW");

  if (!flowEnabled) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-surface-strong" />
          <div className="h-4 w-32 rounded bg-surface-soft" />
          <div className="h-32 rounded bg-surface-soft" />
          <div className="h-64 rounded bg-surface-soft" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong p-5">
        <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-secondary">{description}</p>
      </div>
      <div className="surface-panel p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-56 rounded bg-surface-strong" />
          <div className="h-10 w-full rounded bg-surface-soft" />
          <div className="h-10 w-full rounded bg-surface-soft" />
          <div className="h-48 w-full rounded bg-surface-soft" />
        </div>
      </div>
    </div>
  );
}
