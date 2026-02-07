/**
 * RBAC Guards Tests
 *
 * Tests only the pure functions from guards that don't require
 * React server components or session context.
 */

import { describe, it, expect, vi } from "vitest";

// Mock the session module to avoid React server component issues
vi.mock("../session", () => ({
  getSessionUser: vi.fn(),
}));

// Import after mock
import {
  hasPermission,
  getRolePermissions,
  validateCompanyAccess,
  type Permission,
} from "../guards";
import type { SessionUser } from "../session-config";

describe("RBAC Guards", () => {
  describe("hasPermission", () => {
    it("should grant all permissions to ADMIN", () => {
      const permissions: Permission[] = [
        "user:manage",
        "site:manage",
        "template:manage",
        "contractor:manage",
        "export:create",
        "settings:manage",
        "audit:read",
      ];

      for (const permission of permissions) {
        expect(hasPermission("ADMIN", permission)).toBe(true);
      }
    });

    it("should deny all permissions to VIEWER", () => {
      const permissions: Permission[] = [
        "user:manage",
        "site:manage",
        "template:manage",
        "contractor:manage",
        "export:create",
        "settings:manage",
        "audit:read",
      ];

      for (const permission of permissions) {
        expect(hasPermission("VIEWER", permission)).toBe(false);
      }
    });

    it("should grant permissions to SITE_MANAGER according to Phase 2 requirements", () => {
      expect(hasPermission("SITE_MANAGER", "site:manage")).toBe(true);
      expect(hasPermission("SITE_MANAGER", "contractor:manage")).toBe(true);
      expect(hasPermission("SITE_MANAGER", "export:create")).toBe(true);
      expect(hasPermission("SITE_MANAGER", "template:manage")).toBe(false);
      expect(hasPermission("SITE_MANAGER", "audit:read")).toBe(false);
      expect(hasPermission("SITE_MANAGER", "user:manage")).toBe(false);
      expect(hasPermission("SITE_MANAGER", "settings:manage")).toBe(false);
    });
  });

  describe("getRolePermissions", () => {
    it("should return all permissions for ADMIN", () => {
      const permissions = getRolePermissions("ADMIN");

      expect(permissions).toContain("user:manage");
      expect(permissions).toContain("site:manage");
      expect(permissions).toContain("template:manage");
      expect(permissions.length).toBe(7);
    });

    it("should return empty array for VIEWER", () => {
      const permissions = getRolePermissions("VIEWER");

      expect(permissions).toEqual([]);
    });

    it("should return correct permissions for SITE_MANAGER", () => {
      const permissions = getRolePermissions("SITE_MANAGER");

      expect(permissions).toContain("site:manage");
      expect(permissions).toContain("contractor:manage");
      expect(permissions).toContain("export:create");
      expect(permissions.length).toBe(3);
    });
  });

  describe("validateCompanyAccess", () => {
    const mockUser: SessionUser = {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      role: "ADMIN",
      companyId: "company-1",
      companyName: "Test Company",
      companySlug: "test-company",
    };

    it("should return true for matching company", () => {
      const result = validateCompanyAccess(mockUser, "company-1");

      expect(result).toBe(true);
    });

    it("should return false for different company", () => {
      const result = validateCompanyAccess(mockUser, "company-2");

      expect(result).toBe(false);
    });

    it("should return false for empty company ID", () => {
      const result = validateCompanyAccess(mockUser, "");

      expect(result).toBe(false);
    });
  });
});
