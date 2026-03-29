import { requireAuthPageReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import Link from "next/link";
import { AdminCommandPalette, type CommandPaletteItem } from "./admin-command-palette";
import { AdminNav, type AdminNavSection } from "./admin-nav";

interface NavSectionItem {
  href: string;
  label: string;
  requires?: "contractors" | "escalations";
  exact?: boolean;
}

interface NavSection {
  title: string;
  items: NavSectionItem[];
}

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
  const flowNavCompressionEnabled = isFeatureEnabled("UIX_S2_FLOW");
  const mobileShellEnabled = isFeatureEnabled("UIX_S3_MOBILE");

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
      id: "pre-registrations",
      href: "/admin/pre-registrations",
      title: "Manage Pre-Registrations",
      description: "Create invite links and QR-ready arrivals.",
      keywords: ["invite", "pre-register", "arrival"],
      contexts: ["sites", "dashboard", "live"],
    },
    {
      id: "deliveries",
      href: "/admin/deliveries",
      title: "Open Delivery & Mailroom",
      description: "Track inbound deliveries through arrival and collection.",
      keywords: ["delivery", "mailroom", "courier"],
      contexts: ["dashboard", "sites", "live"],
    },
    {
      id: "resources",
      href: "/admin/resources",
      title: "Open Resources & Booking",
      description: "Manage desk, room, and equipment bookings.",
      keywords: ["resource", "booking", "desk", "room"],
      contexts: ["dashboard", "sites"],
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
      id: "audit-analytics",
      href: "/admin/audit-analytics",
      title: "Open Audit Analytics",
      description: "Review advanced audit trends and security signals.",
      keywords: ["analytics", "security", "audit"],
      contexts: ["dashboard", "history", "exports"],
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
      id: "webhooks",
      href: "/admin/webhooks",
      title: "Review Webhooks",
      description: "Inspect outbound webhook retries and dead-letter events.",
      keywords: ["integration", "delivery", "retry"],
      contexts: ["webhooks", "exports", "dashboard"],
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
    {
      id: "actions",
      href: "/admin/actions",
      title: "Open Action Register",
      description: "Track open, overdue, and blocked safety actions.",
      keywords: ["action", "capa", "follow-up"],
      contexts: ["dashboard", "escalations"],
    },
    {
      id: "inspections",
      href: "/admin/inspections",
      title: "Open Inspections",
      description: "Schedule recurring inspections and record outcomes.",
      keywords: ["inspection", "schedule", "checklist"],
      contexts: ["dashboard", "sites", "escalations"],
    },
    {
      id: "competency",
      href: "/admin/competency",
      title: "Open Competency Matrix",
      description: "Manage site requirements and worker certifications.",
      keywords: ["competency", "certification", "clearance"],
      contexts: ["dashboard", "contractors", "sites"],
    },
  ];

  if (canManageEscalations) {
    commandItems.push(
      {
        id: "escalations",
        href: "/admin/escalations",
        title: "Review Escalations",
        description: "Resolve high-risk sign-in responses.",
        keywords: ["red flag", "approval", "decision"],
        contexts: ["escalations", "dashboard"],
      },
      {
        id: "permits",
        href: "/admin/permits",
        title: "Open Permit-to-Work",
        description: "Manage permit templates, requests, and lifecycle.",
        keywords: ["permit", "ptw", "prequalification"],
        contexts: ["dashboard", "sites", "escalations"],
      },
      {
        id: "safety-forms",
        href: "/admin/safety-forms",
        title: "Open Safety Forms",
        description: "Manage SWMS, JSA, RAMS, toolbox talks, and fatigue forms.",
        keywords: ["swms", "jsa", "rams", "toolbox", "fatigue"],
        contexts: ["dashboard", "sites", "escalations"],
      },
      {
        id: "approvals",
        href: "/admin/approvals",
        title: "Open Approvals",
        description: "Review visitor approvals, watchlists, and ID checks.",
        keywords: ["approval", "watchlist", "identity"],
        contexts: ["dashboard", "escalations"],
      },
      {
        id: "communications",
        href: "/admin/communications",
        title: "Open Communications Hub",
        description: "Launch emergency broadcasts and monitor acknowledgements.",
        keywords: ["broadcast", "emergency", "alerts"],
        contexts: ["dashboard", "live", "escalations"],
      },
      {
        id: "channel-integrations",
        href: "/admin/integrations/channels",
        title: "Manage Channel Integrations",
        description: "Configure Teams and Slack approval loops.",
        keywords: ["teams", "slack", "integration"],
        contexts: ["dashboard", "webhooks", "escalations"],
      },
      {
        id: "procore-connector",
        href: "/admin/integrations/procore",
        title: "Manage Procore Connector",
        description: "Configure named Procore sync and queue connector jobs.",
        keywords: ["procore", "connector", "sync"],
        contexts: ["dashboard", "webhooks", "escalations"],
      },
      {
        id: "prequal-exchange",
        href: "/admin/prequalification-exchange",
        title: "Open Prequalification Exchange",
        description: "Import and map external prequalification snapshots.",
        keywords: ["totika", "sitewise", "prequalification"],
        contexts: ["dashboard", "escalations", "contractors"],
      },
      {
        id: "mobile-ops",
        href: "/admin/mobile",
        title: "Open Mobile Operations",
        description: "Manage push subscriptions and auto check-out hints.",
        keywords: ["mobile", "push", "presence"],
        contexts: ["dashboard", "live"],
      },
      {
        id: "mobile-native-runtime",
        href: "/admin/mobile/native",
        title: "Open Native Runtime",
        description: "Review iOS/Android wrapper and store metadata.",
        keywords: ["ios", "android", "native", "wrapper"],
        contexts: ["dashboard", "live"],
      },
      {
        id: "access-ops",
        href: "/admin/access-ops",
        title: "Open Access Operations",
        description: "Trace gate decisions and resolve hardware outages.",
        keywords: ["gate", "hardware", "turnstile"],
        contexts: ["dashboard", "live", "escalations"],
      },
      {
        id: "evidence",
        href: "/admin/evidence",
        title: "Open Evidence Packs",
        description: "Verify tamper-evident compliance manifests.",
        keywords: ["evidence", "manifest", "audit"],
        contexts: ["dashboard", "exports"],
      },
      {
        id: "policy-simulator",
        href: "/admin/policy-simulator",
        title: "Open Policy Simulator",
        description: "Run what-if simulations for policy settings.",
        keywords: ["simulator", "policy", "scenario"],
        contexts: ["dashboard", "settings"],
      },
      {
        id: "risk-passport",
        href: "/admin/risk-passport",
        title: "Open Risk Passport",
        description: "Review and refresh contractor risk profiles.",
        keywords: ["risk", "contractor", "passport"],
        contexts: ["dashboard", "contractors"],
      },
      {
        id: "safety-copilot",
        href: "/admin/safety-copilot",
        title: "Open Safety Copilot",
        description: "Run AI-assisted safety and permit guidance.",
        keywords: ["ai", "copilot", "safety", "permit"],
        contexts: ["dashboard", "escalations"],
      },
      {
        id: "trust-graph",
        href: "/admin/trust-graph",
        title: "Open Trust Graph",
        description: "Inspect cross-signal contractor trust scores.",
        keywords: ["trust", "graph", "contractor", "risk"],
        contexts: ["dashboard", "contractors"],
      },
      {
        id: "benchmarks",
        href: "/admin/benchmarks",
        title: "Open Predictive Benchmarks",
        description: "Review projected metrics with percentile explainability.",
        keywords: ["benchmark", "predictive", "analytics"],
        contexts: ["dashboard", "history"],
      },
    );
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
      {
        id: "plan-configurator",
        href: "/admin/plan-configurator",
        title: "Open Plan Configurator",
        description: "Schedule and apply modular plan changes.",
        keywords: ["plan", "pricing", "entitlements"],
        contexts: ["settings", "dashboard"],
      },
    );
  }

  const navSections: NavSection[] = [
    {
      title: "Operations",
      items: [
        { href: "/admin", label: "Dashboard", exact: true },
        { href: "/admin/sites", label: "Sites" },
        { href: "/admin/pre-registrations", label: "Pre-Registrations" },
        ...(flowNavCompressionEnabled
          ? []
          : [
              { href: "/admin/deliveries", label: "Deliveries" },
              { href: "/admin/resources", label: "Resources" },
            ]),
        { href: "/admin/live-register", label: "Live Register" },
        ...(flowNavCompressionEnabled
          ? []
          : [{ href: "/admin/command-mode", label: "Command Mode" }]),
        { href: "/admin/history", label: "Sign-In History" },
        ...(flowNavCompressionEnabled
          ? []
          : [{ href: "/admin/audit-analytics", label: "Audit Analytics" }]),
        { href: "/admin/exports", label: "Exports" },
      ],
    },
    {
      title: "Safety & Compliance",
      items: [
        { href: "/admin/hazards", label: "Hazard Register" },
        { href: "/admin/incidents", label: "Incidents" },
        { href: "/admin/actions", label: "Action Register" },
        { href: "/admin/inspections", label: "Inspections" },
        { href: "/admin/escalations", label: "Escalations", requires: "escalations" },
        { href: "/admin/permits", label: "Permit-to-Work" },
        ...(flowNavCompressionEnabled
          ? []
          : [{ href: "/admin/safety-forms", label: "Safety Forms" }]),
        { href: "/admin/approvals", label: "Approvals" },
        ...(flowNavCompressionEnabled
          ? []
          : [{ href: "/admin/communications", label: "Communications Hub" }]),
      ],
    },
    {
      title: "Contractors & Content",
      items: [
        { href: "/admin/contractors", label: "Contractors", requires: "contractors" },
        { href: "/admin/templates", label: "Templates", requires: "contractors" },
        { href: "/admin/risk-passport", label: "Risk Passport" },
        { href: "/admin/competency", label: "Competency Matrix" },
        ...(flowNavCompressionEnabled
          ? []
          : [
              { href: "/admin/trust-graph", label: "Trust Graph" },
              { href: "/admin/benchmarks", label: "Benchmarks" },
            ]),
      ],
    },
    {
      title: "Integrations & Advanced",
      items: [
        { href: "/admin/webhooks", label: "Webhooks" },
        { href: "/admin/integrations/channels", label: "Teams/Slack" },
        { href: "/admin/integrations/procore", label: "Procore Connector" },
        ...(flowNavCompressionEnabled
          ? []
          : [{ href: "/admin/prequalification-exchange", label: "Prequal Exchange" }]),
        { href: "/admin/mobile", label: "Mobile Ops" },
        ...(flowNavCompressionEnabled
          ? []
          : [{ href: "/admin/mobile/native", label: "Native Runtime" }]),
        { href: "/admin/access-ops", label: "Access Ops" },
        ...(flowNavCompressionEnabled
          ? []
          : [
              { href: "/admin/evidence", label: "Evidence Packs" },
              { href: "/admin/policy-simulator", label: "Policy Simulator" },
            ]),
      ],
    },
  ];

  if (user.role === "ADMIN") {
    navSections.push({
      title: "Administration",
      items: [
        { href: "/admin/users", label: "Users" },
        { href: "/admin/audit-log", label: "Audit Log" },
        { href: "/admin/settings", label: "Settings" },
        ...(flowNavCompressionEnabled
          ? []
          : [{ href: "/admin/plan-configurator", label: "Plan Configurator" }]),
      ],
    });
  }

  const canAccessNavItem = (item: NavSectionItem): boolean => {
    if (item.requires === "contractors") return canManageContractors;
    if (item.requires === "escalations") return canManageEscalations;
    return true;
  };
  const mobileQuickSwitchCandidates: NavSectionItem[] = [
    { href: "/admin", label: "Dashboard", exact: true },
    { href: "/admin/sites", label: "Sites" },
    { href: "/admin/live-register", label: "Live Register" },
    { href: "/admin/command-mode", label: "Command Mode" },
    { href: "/admin/incidents", label: "Incidents" },
  ];
  const mobileQuickSwitchItems = mobileQuickSwitchCandidates
    .filter((item) => canAccessNavItem(item))
    .map((item) => ({
      href: item.href,
      label: item.label,
      exact: item.exact,
      isAccessible: true,
    }));
  const visibleNavSections: AdminNavSection[] = navSections.map((section) => ({
    title: section.title,
    items: section.items.map((item) => ({
      href: item.href,
      label: item.label,
      exact: item.exact,
      isAccessible: canAccessNavItem(item),
    })),
  }));

  return (
    <div className="relative min-h-screen">
      <header className="relative z-20 border-b border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)]">
        <div className="mx-auto max-w-[92rem] px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 kinetic-hover">
              <Link
                href="/admin"
                className="shrink-0 kinetic-title text-2xl font-black tracking-tight"
              >
                InductLite
              </Link>
              <span className="hidden text-sm text-muted sm:inline">|</span>
              <span className="max-w-full text-xs text-[color:var(--text-primary)] sm:max-w-[26rem] sm:text-sm lg:max-w-[32rem]">
                {user.companyName}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <AdminCommandPalette commands={commandItems} />

              <span className="hidden max-w-[16rem] truncate rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-1 text-sm text-[color:var(--text-primary)] shadow-soft md:inline-flex md:items-center">
                {user.name}{" "}
                <span className="ml-1 rounded-full border border-indigo-600/50 bg-indigo-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white dark:border-indigo-400/45 dark:bg-indigo-500/25 dark:text-indigo-100">
                  {user.role}
                </span>
              </span>
              <Link
                href="/change-password"
                className="hidden rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-2 text-sm font-medium text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-strong)] md:inline-flex"
              >
                Password
              </Link>
              <form action="/api/auth/logout" method="post" className="hidden md:block">
                <button
                  type="submit"
                  className="rounded-lg border border-[color:var(--accent-danger)] bg-[color:var(--bg-surface)] px-3 py-2 text-sm font-semibold text-[color:var(--accent-danger)] hover:bg-red-100/70 dark:hover:bg-red-500/20"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex min-w-0 flex-col md:flex-row md:gap-4 md:px-4 md:py-4 lg:px-6">
        <nav className="md:min-h-[calc(100vh-102px)] md:w-72 md:shrink-0 md:rounded-2xl md:border md:border-[color:var(--border-soft)] md:bg-[color:var(--bg-surface-strong)] md:px-2 md:py-2 md:shadow-soft">
          <AdminNav
            sections={visibleNavSections}
            mobileShellEnabled={mobileShellEnabled}
            mobileQuickSwitchItems={mobileQuickSwitchItems}
            accountContext={{
              companyName: user.companyName,
              userName: user.name,
              userRole: user.role,
            }}
          />
        </nav>

        <main className="admin-shell-main">
          {children}
        </main>
      </div>
    </div>
  );
}
