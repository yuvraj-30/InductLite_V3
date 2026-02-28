"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface NavLinkProps {
  href: string;
  children: ReactNode;
  exact?: boolean;
}

function isActivePath(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLink({ href, children, exact = false }: NavLinkProps) {
  const pathname = usePathname() ?? "";
  const isActive = isActivePath(pathname, href, exact);

  return (
    <Link
      href={href}
      className={`kinetic-hover block rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
        isActive
          ? "border border-indigo-400/40 bg-indigo-500/20 text-indigo-900 shadow-soft dark:text-indigo-100"
          : "border border-transparent text-secondary hover:border-white/45 hover:bg-white/50 hover:text-[color:var(--text-primary)]"
      }`}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="kinetic-title">{children}</span>
    </Link>
  );
}
