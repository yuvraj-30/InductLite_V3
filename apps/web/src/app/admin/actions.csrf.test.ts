import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  assertOrigin: vi.fn(),
  checkPermission: vi.fn(),
  checkAdmin: vi.fn(),
}));

vi.mock("@/lib/tenant", () => ({
  requireAuthenticatedContextReadOnly: vi
    .fn()
    .mockResolvedValue({ companyId: "company-1", userId: "user-1" }),
}));

vi.mock("@/lib/tenant/context", () => ({
  requireAuthenticatedContextReadOnly: vi
    .fn()
    .mockResolvedValue({ companyId: "company-1", userId: "user-1" }),
}));

vi.mock("@/lib/repository", () => ({
  createSite: vi.fn(),
}));

vi.mock("@/lib/repository/export.repository", () => ({
  createExportJob: vi.fn(),
  countExportJobsSince: vi.fn().mockResolvedValue(0),
  countRunningExportJobs: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: vi.fn().mockReturnValue("req-1"),
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockReturnValue(true),
}));

import { createSiteAction } from "./sites/actions";
import { createExportAction } from "./exports/actions";
import { assertOrigin, checkPermission, checkAdmin } from "@/lib/auth";
import { createSite } from "@/lib/repository";
import { createExportJob } from "@/lib/repository/export.repository";

describe("CSRF enforcement for mutating actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks createSiteAction when assertOrigin fails", async () => {
    vi.mocked(assertOrigin as Mock).mockRejectedValue(
      new Error("Invalid request origin"),
    );

    const result = await createSiteAction(null, new FormData());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid request origin");
    }

    expect(checkPermission).not.toHaveBeenCalled();
    expect(createSite).not.toHaveBeenCalled();
  });

  it("blocks createExportAction when assertOrigin fails", async () => {
    vi.mocked(assertOrigin as Mock).mockRejectedValue(
      new Error("Invalid request origin"),
    );

    const result = await createExportAction({ exportType: "SIGN_IN_CSV" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("FORBIDDEN");
      expect(result.error.message).toBe("Invalid request origin");
    }

    expect(checkAdmin).not.toHaveBeenCalled();
    expect(createExportJob).not.toHaveBeenCalled();
  });
});
