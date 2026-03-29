"use client";

import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminDisclosureSectionProps {
  id?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  summaryMeta?: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
  tone?: "default" | "subtle";
  titleAs?: "h2" | "h3";
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function AdminDisclosureSection({
  id,
  eyebrow,
  title,
  description,
  summaryMeta,
  action,
  defaultOpen = false,
  tone = "default",
  titleAs = "h2",
  className,
  bodyClassName,
  children,
}: AdminDisclosureSectionProps) {
  const Heading = titleAs as ElementType;

  return (
    <details
      id={id}
      open={defaultOpen}
      className={cn(
        "admin-disclosure",
        tone === "subtle" ? "admin-disclosure-subtle" : null,
        className,
      )}
    >
      <summary className="admin-disclosure-summary">
        <div className="admin-disclosure-copy">
          {eyebrow ? (
            <p className="admin-disclosure-eyebrow">{eyebrow}</p>
          ) : null}
          <Heading className="admin-disclosure-title">{title}</Heading>
          {description ? (
            <p className="admin-disclosure-description">{description}</p>
          ) : null}
        </div>
        <div className="admin-disclosure-side">
          {summaryMeta ? (
            <div className="admin-disclosure-meta">{summaryMeta}</div>
          ) : null}
          {action ? <div className="admin-disclosure-action">{action}</div> : null}
          <span className="admin-disclosure-chevron" aria-hidden="true">
            ›
          </span>
        </div>
      </summary>
      <div className={cn("admin-disclosure-body", bodyClassName)}>{children}</div>
    </details>
  );
}
