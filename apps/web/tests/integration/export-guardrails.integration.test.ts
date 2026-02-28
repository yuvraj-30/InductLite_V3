import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { GUARDRAILS } from "../../src/lib/guardrails";
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
  createTestCompany,
  createTestUser,
} from "./setup";

type ExportRepo = typeof import("../../src/lib/repository/export.repository");

describe("Export guardrails integration", () => {
  let prisma: PrismaClient;
  let exportRepo: ExportRepo;
  let companyA: { id: string };
  let companyB: { id: string };
  let userA: { id: string };
  let userB: { id: string };

  beforeAll(async () => {
    await setupTestDatabase();
    prisma = (globalThis as unknown as { prisma: PrismaClient }).prisma;
    exportRepo = await import("../../src/lib/repository/export.repository");
  }, 120000);

  afterAll(async () => {
    await teardownTestDatabase();
  }, 120000);

  beforeEach(async () => {
    await cleanDatabase(prisma);
    companyA = await createTestCompany(prisma, { name: "Company A" });
    companyB = await createTestCompany(prisma, { name: "Company B" });
    userA = await createTestUser(prisma, companyA.id);
    userB = await createTestUser(prisma, companyB.id);
  });

  it("denies enqueue when global export generation budget is exhausted", async () => {
    await prisma.exportJob.create({
      data: {
        company_id: companyB.id,
        export_type: "SIGN_IN_CSV",
        parameters: {},
        requested_by: userB.id,
        status: "SUCCEEDED",
        completed_at: new Date(),
        file_size: 2_100_000_000,
      },
    });

    await expect(
      exportRepo.queueExportJobWithLimits(companyA.id, {
        export_type: "SIGN_IN_CSV",
        parameters: {},
        requested_by: userA.id,
      }),
    ).rejects.toBeInstanceOf(exportRepo.ExportGlobalBytesLimitReachedError);
  });

  it("returns EXPT-003 when tenant download bytes exceed daily cap", async () => {
    await prisma.auditLog.create({
      data: {
        company_id: companyA.id,
        action: "export.download",
        details: {
          download_bytes:
            GUARDRAILS.MAX_EXPORT_DOWNLOAD_BYTES_PER_COMPANY_PER_DAY,
        },
      },
    });

    const result = await exportRepo.checkExportDownloadGuardrails(companyA.id, 1);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.controlId).toBe("EXPT-003");
      expect(result.scope).toBe("tenant");
    }
  });

  it("returns EXPT-004 when global download bytes exceed daily cap", async () => {
    await prisma.auditLog.create({
      data: {
        company_id: companyB.id,
        action: "export.download",
        details: {
          download_bytes: GUARDRAILS.MAX_EXPORT_DOWNLOAD_BYTES_GLOBAL_PER_DAY,
        },
      },
    });

    const result = await exportRepo.checkExportDownloadGuardrails(companyA.id, 1);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.controlId).toBe("EXPT-004");
      expect(result.scope).toBe("environment");
    }
  });
});
