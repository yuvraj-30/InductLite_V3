import { describe, expect, it } from "vitest";
import {
  findActiveNavContext,
  resolveMobileQuickSwitchItems,
  type AdminNavSection,
} from "./admin-nav";

const sections: AdminNavSection[] = [
  {
    title: "Operations",
    items: [
      { href: "/admin", label: "Dashboard", exact: true, isAccessible: true },
      { href: "/admin/sites", label: "Sites", isAccessible: true },
      { href: "/admin/live-register", label: "Live Register", isAccessible: true },
    ],
  },
  {
    title: "Safety",
    items: [
      { href: "/admin/incidents", label: "Incidents", isAccessible: true },
      { href: "/admin/approvals", label: "Approvals", isAccessible: false },
    ],
  },
];

describe("admin-nav mobile helpers", () => {
  it("finds current route context from accessible links", () => {
    const context = findActiveNavContext(sections, "/admin/sites/abc/access");
    expect(context).not.toBeNull();
    expect(context?.sectionTitle).toBe("Operations");
    expect(context?.item.label).toBe("Sites");
  });

  it("skips inaccessible links when resolving context", () => {
    const context = findActiveNavContext(sections, "/admin/approvals");
    expect(context).toBeNull();
  });

  it("resolves provided quick-switch items and caps to five", () => {
    const quickSwitch = resolveMobileQuickSwitchItems(sections, [
      { href: "/admin", label: "Dashboard", exact: true, isAccessible: true },
      { href: "/admin/sites", label: "Sites", isAccessible: true },
      { href: "/admin/live-register", label: "Live Register", isAccessible: true },
      { href: "/admin/command-mode", label: "Command Mode", isAccessible: true },
      { href: "/admin/incidents", label: "Incidents", isAccessible: true },
      { href: "/admin/approvals", label: "Approvals", isAccessible: false },
    ]);

    expect(quickSwitch).toHaveLength(5);
    expect(quickSwitch.every((item) => item.isAccessible)).toBe(true);
  });
});
