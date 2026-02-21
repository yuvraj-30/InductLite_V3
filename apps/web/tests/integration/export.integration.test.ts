import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
  createTestCompany,
  createTestSite,
  createTestSignInRecord,
  createTestTemplate,
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

  it("produces induction CSV with decrypted visitor details", async () => {
    const template = await createTestTemplate(prisma, company.id, site.id);
    const signIn = await createTestSignInRecord(prisma, company.id, site.id, {
      visitorPhone: "021 123 4567",
      visitorName: "Induction Visitor",
    });

    await prisma.signInRecord.update({
      where: { id: signIn.id },
      data: {
        hasAcceptedTerms: true,
        termsAcceptedAt: new Date(),
      },
    });

    await prisma.inductionResponse.create({
      data: {
        sign_in_record_id: signIn.id,
        template_id: template.id,
        template_version: template.version,
        answers: [{ questionId: "q1", answer: true }],
        passed: true,
      },
    });

    const csv = await worker.generateInductionCsvForCompany(company.id);
    expect(csv).toContain("sign_in_record_id");
    expect(csv).toContain("Induction Visitor");
    expect(csv).toContain("+64211234567");
    expect(csv).toContain("answers_json");
  });

  it("builds compliance ZIP bundle with expected files", async () => {
    const template = await createTestTemplate(prisma, company.id, site.id);
    const signIn = await createTestSignInRecord(prisma, company.id, site.id, {
      visitorPhone: "021 123 4567",
      visitorName: "Bundle Visitor",
    });

    await prisma.signInRecord.update({
      where: { id: signIn.id },
      data: {
        hasAcceptedTerms: true,
        termsAcceptedAt: new Date(),
      },
    });

    await prisma.inductionResponse.create({
      data: {
        sign_in_record_id: signIn.id,
        template_id: template.id,
        template_version: template.version,
        answers: [{ questionId: "q1", answer: "yes" }],
        passed: true,
      },
    });

    const zip = await worker.generateComplianceZipForCompany(company.id);
    expect(Buffer.isBuffer(zip)).toBe(true);
    expect(zip.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));

    const zipText = zip.toString("utf8");
    expect(zipText).toContain("summary.pdf");
    expect(zipText).toContain("sign-ins.csv");
    expect(zipText).toContain("induction-details.csv");
    expect(zipText).toContain("signed-acknowledgements.csv");
  });
});
