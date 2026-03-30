import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminSectionHeaderProps {
  id?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  titleAs?: "h1" | "h2" | "h3";
  className?: string;
  contentClassName?: string;
}

export function AdminSectionHeader({
  id,
  eyebrow,
  title,
  description,
  action,
  titleAs = "h2",
  className,
  contentClassName,
}: AdminSectionHeaderProps) {
  const Heading = titleAs as ElementType;

  return (
    <div id={id} className={cn("admin-section-header", className)}>
      <div className={cn("admin-section-copy", contentClassName)}>
        {eyebrow ? <p className="admin-section-eyebrow">{eyebrow}</p> : null}
        <Heading className="admin-section-title">{title}</Heading>
        {description ? (
          <p className="admin-section-description">{description}</p>
        ) : null}
      </div>
      {action ? <div className="admin-section-action">{action}</div> : null}
    </div>
  );
}
