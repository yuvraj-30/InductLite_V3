import Link from "next/link";
import type { OnboardingProgress } from "@/lib/repository/dashboard.repository";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

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
    <div className="kinetic-hover rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4 shadow-trust">
      <div className="flex items-center justify-between">
        <p className="kinetic-title text-sm font-semibold text-[color:var(--text-primary)]">
          {title}
        </p>
        <StatusBadge tone={done ? "success" : "neutral"}>
          {done ? "Done" : "Pending"}
        </StatusBadge>
      </div>
      {!done && canAct && (
        <Link
          href={href}
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "mt-3 w-fit",
          )}
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
  description = "Complete these three steps to launch your first live induction.",
  showWhenComplete = false,
  canManageSites = true,
  canManageTemplates = true,
}: OnboardingChecklistProps) {
  if (!showWhenComplete && progress.onboardingComplete) {
    return null;
  }

  return (
    <div
      className={`surface-panel-strong kinetic-hover border-[color:var(--border-strong)] p-5 ${className}`.trim()}
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

