import { requireAuthPageReadOnly } from "@/lib/auth";
import Link from "next/link";
import { AdminCommandPalette, type CommandPaletteItem } from "./admin-command-palette";
import { NavLink } from "./nav-link";

/**
 * Admin Layout
 *
 * Shared layout for all admin pages with navigation sidebar.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuthPageReadOnly();
  const canManageContractors =
    user.role === "ADMIN" || user.role === "SITE_MANAGER";
  const canManageEscalations =
    user.role === "ADMIN" || user.role === "SITE_MANAGER";

  const commandItems: CommandPaletteItem[] = [
    {
      id: "dashboard",
      href: "/admin/dashboard",
      title: "Open Dashboard",
      description: "View live metrics and activation status.",
      keywords: ["overview", "kpi", "home"],
      contexts: ["dashboard"],
    },
    {
      id: "sites",
      href: "/admin/sites",
      title: "View Sites",
      description: "Manage active sites and public QR links.",
      keywords: ["site", "locations", "qr"],
      contexts: ["sites", "dashboard"],
    },
    {
      id: "live-register",
      href: "/admin/live-register",
      title: "Open Live Register",
      description: "Track everyone currently on site.",
      keywords: ["onsite", "headcount", "live"],
      contexts: ["live", "dashboard"],
    },
    {
      id: "command-mode",
      href: "/admin/command-mode",
      title: "Launch Command Mode",
      description: "Run overstay alerts and roll call operations.",
      keywords: ["evacuation", "roll call", "alerts"],
      contexts: ["live", "dashboard", "escalations"],
    },
    {
      id: "history",
      href: "/admin/history",
      title: "Search Sign-In History",
      description: "Audit sign-in and sign-out records.",
      keywords: ["history", "timeline", "audit"],
      contexts: ["history", "dashboard", "exports"],
    },
    {
      id: "exports",
      href: "/admin/exports",
      title: "Go to Exports",
      description: "Queue and review compliance exports.",
      keywords: ["csv", "audit pack", "download"],
      contexts: ["exports", "dashboard", "history"],
    },
    {
      id: "hazards",
      href: "/admin/hazards",
      title: "Open Hazard Register",
      description: "Review and update active hazards.",
      keywords: ["risk", "hazard", "safety"],
      contexts: ["dashboard", "escalations"],
    },
    {
      id: "incidents",
      href: "/admin/incidents",
      title: "Open Incidents",
      description: "Log and manage incident records.",
      keywords: ["incident", "worksafe", "report"],
      contexts: ["dashboard", "escalations"],
    },
  ];

  if (canManageEscalations) {
    commandItems.push({
      id: "escalations",
      href: "/admin/escalations",
      title: "Review Escalations",
      description: "Resolve high-risk sign-in responses.",
      keywords: ["red flag", "approval", "decision"],
      contexts: ["escalations", "dashboard"],
    });
  }

  if (canManageContractors) {
    commandItems.push(
      {
        id: "contractors",
        href: "/admin/contractors",
        title: "View Contractors",
        description: "Manage contractor profiles and status.",
        keywords: ["contractor", "people", "records"],
        contexts: ["contractors", "dashboard"],
      },
      {
        id: "new-contractor",
        href: "/admin/contractors/new",
        title: "Create Contractor",
        description: "Add a new contractor profile.",
        keywords: ["add contractor", "new profile"],
        contexts: ["contractors", "dashboard"],
      },
      {
        id: "templates",
        href: "/admin/templates",
        title: "Manage Templates",
        description: "Edit and publish induction templates.",
        keywords: ["questions", "induction", "template"],
        contexts: ["templates", "dashboard"],
      },
      {
        id: "new-template",
        href: "/admin/templates/new",
        title: "Create Template",
        description: "Start a new induction template.",
        keywords: ["new template", "questionnaire"],
        contexts: ["templates", "dashboard"],
      },
      {
        id: "new-site",
        href: "/admin/sites/new",
        title: "Create Site",
        description: "Add a new operational site.",
        keywords: ["new site", "location"],
        contexts: ["sites", "dashboard"],
      },
    );
  }

  if (user.role === "ADMIN") {
    commandItems.push(
      {
        id: "users",
        href: "/admin/users",
        title: "Manage Users",
        description: "Control role access and account states.",
        keywords: ["rbac", "team", "permissions"],
        contexts: ["users", "settings", "dashboard"],
      },
      {
        id: "audit-log",
        href: "/admin/audit-log",
        title: "Open Audit Log",
        description: "Inspect immutable admin activity trail.",
        keywords: ["security", "audit", "trail"],
        contexts: ["dashboard", "history", "users"],
      },
      {
        id: "settings",
        href: "/admin/settings",
        title: "Open Settings",
        description: "Adjust compliance and policy options.",
        keywords: ["settings", "compliance", "policy"],
        contexts: ["settings", "dashboard"],
      },
    );
  }

  return (
    <div className="relative min-h-screen">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
      </div>

      <header className="relative z-20 border-b border-white/35 bg-[color:var(--bg-surface-strong)]">
        <div className="mx-auto max-w-[92rem] px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3 kinetic-hover">
              <Link
                href="/admin"
                className="shrink-0 kinetic-title text-2xl font-black tracking-tight"
              >
                InductLite
              </Link>
              <span className="text-sm text-muted">|</span>
              <span className="truncate text-sm text-[color:var(--text-primary)]">
                {user.companyName}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <AdminCommandPalette commands={commandItems} />

              <span className="max-w-[16rem] truncate rounded-full border border-white/40 bg-[color:var(--bg-surface)] px-3 py-1 text-sm text-[color:var(--text-primary)] shadow-soft">
                {user.name}{" "}
                <span className="ml-1 rounded-full border border-indigo-500/35 bg-indigo-500/25 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-900 dark:text-indigo-100">
                  {user.role}
                </span>
              </span>
              <Link
                href="/change-password"
                className="rounded-lg border border-white/35 bg-[color:var(--bg-surface)] px-3 py-2 text-sm font-medium text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-strong)]"
              >
                Password
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="rounded-lg border border-red-700/70 bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex min-w-0 flex-col md:flex-row md:gap-4 md:px-4 md:py-4 lg:px-6">
        <nav className="border-b border-white/30 bg-[color:var(--bg-surface-strong)] md:min-h-[calc(100vh-102px)] md:w-72 md:shrink-0 md:rounded-2xl md:border md:px-2 md:py-2 md:shadow-soft">
          <ul className="flex gap-1 overflow-x-auto px-2 py-2 md:block md:space-y-1 md:overflow-visible md:p-3">
            <li>
              <NavLink href="/admin" exact>
                Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink href="/admin/sites">Sites</NavLink>
            </li>
            <li>
              <NavLink href="/admin/hazards">Hazard Register</NavLink>
            </li>
            <li>
              <NavLink href="/admin/incidents">Incidents</NavLink>
            </li>
            <li>
              <NavLink href="/admin/live-register">Live Register</NavLink>
            </li>
            <li>
              {canManageEscalations ? (
                <NavLink href="/admin/escalations">Escalations</NavLink>
              ) : (
                <span className="block cursor-not-allowed rounded-xl px-4 py-2 text-sm text-muted opacity-80">
                  Escalations
                </span>
              )}
            </li>
            <li>
              <NavLink href="/admin/command-mode">Command Mode</NavLink>
            </li>
            <li>
              <NavLink href="/admin/history">Sign-In History</NavLink>
            </li>
            <li>
              <NavLink href="/admin/exports">Exports</NavLink>
            </li>
            <li>
              {canManageContractors ? (
                <NavLink href="/admin/contractors">Contractors</NavLink>
              ) : (
                <span className="block cursor-not-allowed rounded-xl px-4 py-2 text-sm text-muted opacity-80">
                  Contractors
                </span>
              )}
            </li>
            <li>
              <NavLink href="/admin/templates">Templates</NavLink>
            </li>
            {user.role === "ADMIN" && (
              <>
                <li className="mt-4 border-t border-white/35 pt-4">
                  <span className="block px-4 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
                    Admin
                  </span>
                </li>
                <li>
                  <NavLink href="/admin/users">Users</NavLink>
                </li>
                <li>
                  <NavLink href="/admin/audit-log">Audit Log</NavLink>
                </li>
                <li>
                  <NavLink href="/admin/settings">Settings</NavLink>
                </li>
              </>
            )}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 p-4 sm:p-6 md:rounded-2xl md:border md:border-white/25 md:bg-[color:var(--bg-surface)] md:shadow-soft">
          {children}
        </main>
      </div>
    </div>
  );
}
