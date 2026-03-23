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

  it("fails stale queued exports before admitting a fresh export", async () => {
    const staleQueuedAt = new Date(
      Date.now() - (GUARDRAILS.MAX_EXPORT_QUEUE_AGE_MINUTES + 5) * 60 * 1000,
    );

    const staleJob = await prisma.exportJob.create({
      data: {
        company_id: companyB.id,
        export_type: "SIGN_IN_CSV",
        parameters: {},
        requested_by: userB.id,
        status: "QUEUED",
        queued_at: staleQueuedAt,
        run_at: staleQueuedAt,
      },
    });

    const queuedJob = await exportRepo.queueExportJobWithLimits(companyA.id, {
      export_type: "SIGN_IN_CSV",
      parameters: {},
      requested_by: userA.id,
    });

    expect(queuedJob.company_id).toBe(companyA.id);
    expect(queuedJob.status).toBe("QUEUED");

    const refreshedStaleJob = await prisma.exportJob.findUniqueOrThrow({
      where: { id: staleJob.id },
    });
    expect(refreshedStaleJob.status).toBe("FAILED");
    expect(refreshedStaleJob.error_message).toContain(
      "MAX_EXPORT_QUEUE_AGE_MINUTES",
    );
  });

  it("auto-enables off-peak processing when delayed exports exceed the rolling threshold", async () => {
    const now = new Date();
    const delayedQueuedAt = new Date(now.getTime() - 5 * 60 * 1000);

    await prisma.exportJob.create({
      data: {
        company_id: companyA.id,
        export_type: "SIGN_IN_CSV",
        parameters: {},
        requested_by: userA.id,
        status: "SUCCEEDED",
        queued_at: delayedQueuedAt,
        started_at: new Date(now.getTime() - 3 * 60 * 1000),
        completed_at: new Date(now.getTime() - 2 * 60 * 1000),
      },
    });

    for (let index = 0; index < 4; index += 1) {
      const queuedAt = new Date(now.getTime() - (index + 1) * 30 * 1000);
      await prisma.exportJob.create({
        data: {
          company_id: companyA.id,
          export_type: "SIGN_IN_CSV",
          parameters: {},
          requested_by: userA.id,
          status: "SUCCEEDED",
          queued_at: queuedAt,
          started_at: new Date(queuedAt.getTime() + 10 * 1000),
          completed_at: new Date(queuedAt.getTime() + 20 * 1000),
        },
      });
    }

    const decision = await exportRepo.getExportOffPeakDecision(now);

    expect(decision.active).toBe(true);
    expect(decision.reason).toBe("auto");
    expect(decision.delayedJobs).toBe(1);
    expect(decision.observedJobs).toBe(5);
    expect(decision.delayedPercent).toBe(20);
  });
});
