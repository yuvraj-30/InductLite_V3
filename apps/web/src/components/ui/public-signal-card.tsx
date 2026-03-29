import * as React from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PublicSignalCardProps {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}

export function PublicSignalCard({
  eyebrow,
  title,
  description,
  className,
}: PublicSignalCardProps) {
  return (
    <article className={cn("public-signal-card", className)}>
      <p className="public-signal-eyebrow">{eyebrow}</p>
      <p className="public-signal-title">{title}</p>
      {description ? (
        <p className="public-signal-description">{description}</p>
      ) : null}
    </article>
  );
}
