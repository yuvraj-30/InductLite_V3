import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  cleanDatabase,
  createTestCompany,
  createTestSite,
  setupTestDatabase,
  teardownTestDatabase,
} from "./setup";

type RiskPassportRepo = typeof import("../../src/lib/repository/risk-passport.repository");

describe("Risk passport integration", () => {
  let prisma: PrismaClient;
  let riskPassportRepo: RiskPassportRepo;
  let company: { id: string };
  let site: { id: string };

  beforeAll(async () => {
    await setupTestDatabase();
    prisma = (globalThis as unknown as { prisma: PrismaClient }).prisma;
    riskPassportRepo = await import("../../src/lib/repository/risk-passport.repository");
  }, 120000);

  afterAll(async () => {
    await teardownTestDatabase();
  }, 120000);

  beforeEach(async () => {
    await cleanDatabase(prisma);
    company = await createTestCompany(prisma);
    site = await createTestSite(prisma, company.id);
  });

  it("includes incidents and quiz failures in contractor risk components", async () => {
    const contractor = await prisma.contractor.create({
      data: {
        company_id: company.id,
        name: "Alpha Electrical Ltd",
        contact_email: "safety@alpha.example.nz",
        contact_phone: "+64210001000",
        is_active: true,
      },
    });

    await prisma.contractorDocument.create({
      data: {
        contractor_id: contractor.id,
        document_type: "CERTIFICATION",
        file_name: "license.pdf",
        file_path: "contractors/license.pdf",
        file_size: 1024,
        mime_type: "application/pdf",
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });

    const permitTemplate = await prisma.permitTemplate.create({
      data: {
        company_id: company.id,
        site_id: site.id,
        name: "Hot Work",
        permit_type: "HOT_WORK",
        is_required_for_signin: false,
      },
    });

    await prisma.permitRequest.create({
      data: {
        company_id: company.id,
        site_id: site.id,
        permit_template_id: permitTemplate.id,
        contractor_id: contractor.id,
        status: "DENIED",
      },
    });

    await prisma.contractorPrequalification.create({
      data: {
        company_id: company.id,
        contractor_id: contractor.id,
        site_id: site.id,
        score: 40,
        status: "PENDING",
      },
    });

    const template = await prisma.inductionTemplate.create({
      data: {
        company_id: company.id,
        site_id: site.id,
        name: "Site induction",
        version: 1,
        is_published: true,
      },
    });

    const signIn = await prisma.signInRecord.create({
      data: {
        company_id: company.id,
        site_id: site.id,
        visitor_name: "Alex Worker",
        visitor_phone: "+64210001000",
        visitor_email: "safety@alpha.example.nz",
        employer_name: "Alpha Electrical Ltd",
        visitor_type: "CONTRACTOR",
      },
    });

    await prisma.inductionResponse.create({
      data: {
        sign_in_record_id: signIn.id,
        template_id: template.id,
        template_version: 1,
        answers: [],
        passed: false,
      },
    });

    await prisma.incidentReport.create({
      data: {
        company_id: company.id,
        site_id: site.id,
        sign_in_record_id: signIn.id,
        title: "Near-miss at ladder bay",
        severity: "MEDIUM",
        incident_type: "NEAR_MISS",
      },
    });

    const refreshed = await riskPassportRepo.refreshContractorRiskScore(company.id, {
      contractor_id: contractor.id,
      site_id: site.id,
    });

    const components = refreshed.components as Record<string, unknown>;

    expect(refreshed.current_score).toBe(57);
    expect(refreshed.threshold_state).toBe("MEDIUM");
    expect(components.expired_documents).toBe(1);
    expect(components.permit_breaches).toBe(1);
    expect(components.prequalification_penalty).toBe(8);
    expect(components.incident_reports_180d).toBe(1);
    expect(components.quiz_failures_180d).toBe(1);
  });
});
