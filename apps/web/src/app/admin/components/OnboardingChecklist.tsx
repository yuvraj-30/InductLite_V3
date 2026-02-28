import Link from "next/link";
import type { OnboardingProgress } from "@/lib/repository/dashboard.repository";

interface OnboardingChecklistProps {
  progress: OnboardingProgress;
  className?: string;
  title?: string;
  description?: string;
  showWhenComplete?: boolean;
  canManageSites?: boolean;
  canManageTemplates?: boolean;
}

interface StepCardProps {
  done: boolean;
  title: string;
  href: string;
  actionLabel: string;
  canAct?: boolean;
}

function StepCard({ done, title, href, actionLabel, canAct = true }: StepCardProps) {
  return (
    <div className="kinetic-hover rounded-xl border border-white/40 bg-white/55 p-4 shadow-soft backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <p className="kinetic-title text-sm font-semibold text-[color:var(--text-primary)]">
          {title}
        </p>
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
            done
              ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100"
              : "border-white/35 bg-white/55 text-secondary"
          }`}
        >
          {done ? "Done" : "Pending"}
        </span>
      </div>
      {!done && canAct && (
        <Link
          href={href}
          className="mt-3 inline-flex items-center rounded-lg border border-indigo-400/30 bg-indigo-500/15 px-3 py-1.5 text-sm font-semibold text-indigo-900 shadow-soft hover:bg-indigo-500/25 dark:text-indigo-100"
        >
          {actionLabel} -&gt;
        </Link>
      )}
      {!done && !canAct && (
        <p className="mt-3 text-xs text-muted">
          Ask an admin to complete this step.
        </p>
      )}
    </div>
  );
}

export function OnboardingChecklist({
  progress,
  className = "",
  title = "Getting Started Checklist",
  description = "Complete these to get your first successful induction live.",
  showWhenComplete = false,
  canManageSites = true,
  canManageTemplates = true,
}: OnboardingChecklistProps) {
  if (!showWhenComplete && progress.onboardingComplete) {
    return null;
  }

  return (
    <div
      className={`surface-panel-strong kinetic-hover border-indigo-400/25 bg-gradient-to-br from-indigo-500/12 via-cyan-400/10 to-transparent p-5 ${className}`.trim()}
    >
      <h2 className="kinetic-title text-lg font-black text-[color:var(--text-primary)]">{title}</h2>
      <p className="mt-1 text-sm text-secondary">{description}</p>
      <div className="mt-4 bento-grid grid-cols-1 md:grid-cols-3">
        <StepCard
          done={progress.hasSites}
          title="Create Site"
          href="/admin/sites/new"
          actionLabel="Create Site"
          canAct={canManageSites}
        />
        <StepCard
          done={progress.hasPublishedTemplate}
          title="Publish Template"
          href="/admin/templates"
          actionLabel="Manage Templates"
          canAct={canManageTemplates}
        />
        <StepCard
          done={progress.hasFirstSignIn}
          title="Run First Induction"
          href="/admin/sites"
          actionLabel="Open Site QR"
        />
      </div>
    </div>
  );
}
