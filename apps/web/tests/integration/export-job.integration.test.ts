import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
  createTestCompany,
  createTestSite,
  createTestSignInRecord,
} from "./setup";

import * as fs from "fs/promises";
import path from "path";

type Runner = typeof import("../../src/lib/export/runner");

describe("Export Job Runner - end-to-end CSV export", () => {
  let prisma: PrismaClient;
  let runner: Runner;
  let company: { id: string; slug: string };
  let site: { id: string; name: string };

  beforeAll(async () => {
    const res = await setupTestDatabase();
    prisma = res.prisma;

    runner = await import("../../src/lib/export/runner");
  }, 120000);

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    company = await createTestCompany(prisma);
    site = await createTestSite(prisma, company.id);
  });

  it("processes queued SIGN_IN_CSV job and writes file with E.164 phone", async () => {
    // Create a sign-in with local phone format
    await createTestSignInRecord(prisma, company.id, site.id, {
      visitorPhone: "021 123 4567",
      visitorName: "Exported Visitor",
    });

    const job = await prisma.exportJob.create({
      data: {
        company_id: company.id,
        export_type: "SIGN_IN_CSV",
        parameters: {},
        requested_by: "u-test",
      },
    });

    const res = await runner.processNextExportJob();
    expect(res).not.toBeNull();

    const updated = await prisma.exportJob.findUnique({
      where: { id: job.id },
    });
    expect(updated).not.toBeNull();
    expect(updated?.status).toBe("SUCCEEDED");
    expect(updated?.file_path).toBeTruthy();

    // verify file exists and contains E.164 phone
    const filePath = updated!.file_path as string;
    const data = await fs.readFile(path.resolve(filePath), "utf8");
    expect(data).toMatch(/\+64211234567/);
  });
});
