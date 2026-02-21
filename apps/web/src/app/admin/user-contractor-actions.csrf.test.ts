import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  assertOrigin: vi.fn(),
  checkAdmin: vi.fn(),
  checkPermission: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock("@/lib/tenant/context", () => ({
  requireAuthenticatedContextReadOnly: vi
    .fn()
    .mockResolvedValue({ companyId: "company-1", userId: "user-1" }),
}));

vi.mock("@/lib/repository", () => ({
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deactivateUser: vi.fn(),
  reactivateUser: vi.fn(),
  purgeInactiveUser: vi.fn(),
  findUserById: vi.fn(),
  createContractor: vi.fn(),
  updateContractor: vi.fn(),
  deactivateContractor: vi.fn(),
  purgeInactiveContractor: vi.fn(),
  findContractorById: vi.fn(),
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: vi.fn().mockReturnValue("req-1"),
}));

import { assertOrigin, checkAdmin, checkPermission } from "@/lib/auth";
import {
  createUser,
  createContractor,
  purgeInactiveUser,
  purgeInactiveContractor,
} from "@/lib/repository";
import { createUserAction, purgeUserAction } from "./users/actions";
import {
  createContractorAction,
  purgeContractorAction,
} from "./contractors/actions";

describe("CSRF enforcement for user/contractor admin actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks createUserAction when assertOrigin fails", async () => {
    vi.mocked(assertOrigin as Mock).mockRejectedValue(
      new Error("Invalid request origin"),
    );

    const result = await createUserAction(null, new FormData());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid request origin");
    }

    expect(checkAdmin).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("blocks createContractorAction when assertOrigin fails", async () => {
    vi.mocked(assertOrigin as Mock).mockRejectedValue(
      new Error("Invalid request origin"),
    );

    const result = await createContractorAction(null, new FormData());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid request origin");
    }

    expect(checkPermission).not.toHaveBeenCalled();
    expect(createContractor).not.toHaveBeenCalled();
  });

  it("blocks purgeUserAction when assertOrigin fails", async () => {
    vi.mocked(assertOrigin as Mock).mockRejectedValue(
      new Error("Invalid request origin"),
    );

    const result = await purgeUserAction("cmluleelx00023r2djbr8hudu");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid request origin");
    }

    expect(checkAdmin).not.toHaveBeenCalled();
    expect(purgeInactiveUser).not.toHaveBeenCalled();
  });

  it("blocks purgeContractorAction when assertOrigin fails", async () => {
    vi.mocked(assertOrigin as Mock).mockRejectedValue(
      new Error("Invalid request origin"),
    );

    const result = await purgeContractorAction("cmluleelx00023r2djbr8hudu");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid request origin");
    }

    expect(checkPermission).not.toHaveBeenCalled();
    expect(purgeInactiveContractor).not.toHaveBeenCalled();
  });
});
