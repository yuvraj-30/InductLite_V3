import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkSitePermission } from "../../src/lib/auth/guards";
import type { SessionUser } from "../../src/lib/auth/session-config";

// Mock the repository to simulate site ownership
vi.mock("@/lib/repository/site-manager.repository", () => ({
  isUserSiteManagerForSite: vi.fn(async (_companyId, userId, siteId) => {
    // Logic: user-1 manages site-1, user-2 manages site-2
    if (userId === "user-1" && siteId === "site-1") return true;
    if (userId === "user-2" && siteId === "site-2") return true;
    return false;
  }),
}));

// Mock session module
vi.mock("../../src/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

import { getSessionUser } from "../../src/lib/auth/session";

describe("RBAC Matrix Integration", () => {
  const companyId = "company-1";

  const createMockUser = (id: string, role: any): SessionUser => ({
    id,
    email: `${id}@example.com`,
    name: id,
    role,
    companyId,
    companyName: "Test Co",
    companySlug: "test-co",
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Site Manager accessing OWN site should be allowed", async () => {
    const user = createMockUser("user-1", "SITE_MANAGER");
    vi.mocked(getSessionUser).mockResolvedValue(user);

    const result = await checkSitePermission("site:manage", "site-1");
    expect(result.success).toBe(true);
  });

  it("Site Manager accessing OTHER site should be forbidden", async () => {
    const user = createMockUser("user-1", "SITE_MANAGER");
    vi.mocked(getSessionUser).mockResolvedValue(user);

    const result = await checkSitePermission("site:manage", "site-2");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("FORBIDDEN");
    }
  });

  it("Viewer accessing Audit Logs should be forbidden", async () => {
    const user = createMockUser("user-viewer", "VIEWER");
    vi.mocked(getSessionUser).mockResolvedValue(user);

    const result = await checkSitePermission("audit:read" as any, "site-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("FORBIDDEN");
    }
  });

  it("Admin accessing ANY site should be allowed", async () => {
    const user = createMockUser("admin-1", "ADMIN");
    vi.mocked(getSessionUser).mockResolvedValue(user);

    const result = await checkSitePermission("site:manage", "site-2");
    expect(result.success).toBe(true);
  });
});
