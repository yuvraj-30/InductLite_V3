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

type ExportWorker = typeof import("../../src/lib/export/worker");

describe("Export Worker - CSV generation", () => {
  let prisma: PrismaClient;
  let worker: ExportWorker;
  let company: { id: string; slug: string };
  let site: { id: string; name: string };
  const globalAny = globalThis as unknown as { prisma: PrismaClient };

  beforeAll(async () => {
    await setupTestDatabase();
    prisma = globalAny.prisma;
    // Dynamic import after DB is configured
    worker = await import("../../src/lib/export/worker");
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    company = await createTestCompany(prisma);
    site = await createTestSite(prisma, company.id);
  });

  it("produces CSV with E.164-formatted phone numbers for local input", async () => {
    // Insert a sign-in with a local NZ format phone
    await createTestSignInRecord(prisma, company.id, site.id, {
      visitorPhone: "021 123 4567",
      visitorName: "CSV Visitor",
    });

    const csv = await worker.generateSignInCsvForCompany(company.id);

    // Header should include visitor_phone and the phone should be E.164
    expect(csv).toContain("visitor_phone");
    expect(csv).toMatch(/\+64211234567/);
  });

  it("returns empty string when no records", async () => {
    const csv = await worker.generateSignInCsvForCompany(company.id);
    expect(csv).toBe("");
  });
});
