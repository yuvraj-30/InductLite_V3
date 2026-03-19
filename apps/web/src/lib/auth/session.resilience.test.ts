import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnscopedUserByEmail: vi.fn(),
  scopedDb: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  needsRehash: vi.fn(),
  getIronSession: vi.fn(),
  createRequestLogger: vi.fn(),
}));

vi.mock("@/lib/db/scoped", () => ({
  findUnscopedUserByEmail: mocks.findUnscopedUserByEmail,
}));

vi.mock("@/lib/db/scoped-db", () => ({
  scopedDb: mocks.scopedDb,
}));

vi.mock("./password", () => ({
  verifyPassword: mocks.verifyPassword,
  hashPassword: mocks.hashPassword,
  needsRehash: mocks.needsRehash,
}));

vi.mock("iron-session", () => ({
  getIronSession: mocks.getIronSession,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({}),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("./csrf", () => ({
  generateRequestId: () => "req-1",
  generateCsrfToken: () => "csrf-token",
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

import { login } from "./session";

describe("auth session resilience", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createRequestLogger.mockReturnValue({
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    });
  });

  it("returns invalid credentials when audit logging fails on wrong password", async () => {
    mocks.findUnscopedUserByEmail.mockResolvedValue({
      id: "user-1",
      company_id: "company-1",
      email: "viewer@buildright.co.nz",
      name: "Viewer User",
      role: "VIEWER",
      is_active: true,
      failed_logins: 0,
      locked_until: null,
      password_hash: "$argon2id$mock",
      totp_secret: null,
      company: { id: "company-1", name: "BuildRight NZ", slug: "buildright-nz" },
    });
    mocks.verifyPassword.mockResolvedValue(false);

    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const auditCreate = vi.fn().mockRejectedValue(new Error("audit unavailable"));
    mocks.scopedDb.mockReturnValue({
      user: { updateMany },
      auditLog: { create: auditCreate },
    });

    const result = await login("viewer@buildright.co.nz", "wrong-password");

    expect(result).toEqual({
      success: false,
      error: "Invalid email or password",
    });
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });

  it("still succeeds when success-audit logging fails", async () => {
    mocks.findUnscopedUserByEmail.mockResolvedValue({
      id: "user-2",
      company_id: "company-2",
      email: "admin@buildright.co.nz",
      name: "Admin User",
      role: "ADMIN",
      is_active: true,
      failed_logins: 0,
      locked_until: null,
      password_hash: "$argon2id$mock",
      totp_secret: null,
      company: { id: "company-2", name: "BuildRight NZ", slug: "buildright-nz" },
    });
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.needsRehash.mockReturnValue(false);

    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const auditCreate = vi.fn().mockRejectedValue(new Error("audit unavailable"));
    mocks.scopedDb.mockReturnValue({
      user: { updateMany },
      auditLog: { create: auditCreate },
    });

    const save = vi.fn().mockResolvedValue(undefined);
    mocks.getIronSession.mockResolvedValue({
      save,
      destroy: vi.fn(),
      user: undefined,
      csrfToken: undefined,
      createdAt: undefined,
      lastActivity: undefined,
    });

    const result = await login("admin@buildright.co.nz", "Admin123!");

    expect(result.success).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });
});
