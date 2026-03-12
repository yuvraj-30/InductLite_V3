"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface NavLinkProps {
  href: string;
  children: ReactNode;
  exact?: boolean;
  variant?: "default" | "compact";
  className?: string;
}

function isActivePath(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLink({
  href,
  children,
  exact = false,
  variant = "default",
  className = "",
}: NavLinkProps) {
  const pathname = usePathname() ?? "";
  const isActive = isActivePath(pathname, href, exact);

  const sharedStyles =
    variant === "compact"
      ? "block rounded-xl px-3 py-2 text-xs font-semibold transition-all"
      : "kinetic-hover block rounded-xl px-4 py-2.5 text-sm font-medium transition-all";

  const activeStyles =
    "border border-[color:var(--accent-cyber)] bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)] shadow-soft";
  const inactiveStyles =
    "border border-transparent text-secondary hover:border-[color:var(--border-soft)] hover:bg-[color:var(--bg-surface-strong)] hover:text-[color:var(--text-primary)]";

  return (
    <Link
      href={href}
      className={`${sharedStyles} ${isActive ? activeStyles : inactiveStyles} ${className}`.trim()}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="kinetic-title">{children}</span>
    </Link>
  );
}
