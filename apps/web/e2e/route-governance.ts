export interface PerfRouteBudget {
  label: string;
  route: string;
  lcpMs: number;
  tbtMs: number;
  cls: number;
  inpMs: number;
  jsBytes: number;
}

export const A11Y_PUBLIC_ROUTES = ["/", "/login"] as const;

export const A11Y_ADMIN_ROUTES = [
  "/admin/dashboard",
  "/admin/live-register",
  "/admin/sites",
  "/admin/sites/new",
  "/admin/templates",
  "/admin/templates/new",
  "/admin/history",
  "/admin/exports",
  "/admin/audit-log",
  "/admin/users",
  "/admin/users/new",
  "/admin/contractors",
  "/admin/pre-registrations",
  "/admin/hazards",
  "/admin/incidents",
  "/admin/settings",
  "/admin/plan-configurator",
  "/admin/policy-simulator",
  "/admin/risk-passport",
] as const;

export const PERF_BUDGET_ROUTES: PerfRouteBudget[] = [
  {
    label: "login",
    route: "/login",
    lcpMs: 2500,
    tbtMs: 1500,
    cls: 0.15,
    inpMs: 350,
    jsBytes: 400_000,
  },
  {
    label: "sites",
    route: "/admin/sites",
    lcpMs: 2500,
    tbtMs: 3300,
    cls: 0.15,
    inpMs: 400,
    jsBytes: 575_000,
  },
  {
    label: "live-register",
    route: "/admin/live-register",
    lcpMs: 2500,
    tbtMs: 3200,
    cls: 0.15,
    inpMs: 450,
    jsBytes: 625_000,
  },
  {
    label: "settings",
    route: "/admin/settings",
    lcpMs: 2800,
    tbtMs: 3500,
    cls: 0.15,
    inpMs: 450,
    jsBytes: 650_000,
  },
  {
    label: "induction",
    route: "/s/:slug",
    lcpMs: 2500,
    tbtMs: 2200,
    cls: 0.1,
    inpMs: 350,
    jsBytes: 700_000,
  },
];
