import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
  createTestCompany,
  createTestUser,
} from "./setup";

type ExportRepo = typeof import("@/lib/repository/export.repository");

describe("Export Job claim idempotency", () => {
  let prisma: PrismaClient;
  let company: { id: string };
  let user: { id: string };
  let exportRepo: ExportRepo;

  beforeAll(async () => {
    const res = await setupTestDatabase();
    prisma = res.prisma;
    exportRepo = await import("@/lib/repository/export.repository");
  }, 120000);

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    company = await createTestCompany(prisma);
    user = await createTestUser(prisma, company.id);
  });

  it("claims a queued job only once", async () => {
    const job = await prisma.exportJob.create({
      data: {
        company_id: company.id,
        export_type: "SIGN_IN_CSV",
        parameters: {},
        requested_by: user.id,
        status: "QUEUED",
      },
    });

    const first = await exportRepo.claimNextQueuedExportJob();
    const second = await exportRepo.claimNextQueuedExportJob();

    expect(first?.id).toBe(job.id);
    expect(second).toBeNull();

    const stored = await prisma.exportJob.findFirst({ where: { id: job.id } });
    expect(stored?.status).toBe("RUNNING");
  });
});
