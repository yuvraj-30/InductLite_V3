import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  cleanDatabase,
  createTestCompany,
  createTestSignInRecord,
  createTestSite,
  createTestUser,
  setupTestDatabase,
  teardownTestDatabase,
} from "./setup";

type IncidentRepository = typeof import("../../src/lib/repository/incident.repository");

describe("Incident reports repository integration", () => {
  let prisma: PrismaClient;
  let incidents: IncidentRepository;

  const globalAny = globalThis as unknown as { prisma: PrismaClient };

  beforeAll(async () => {
    await setupTestDatabase();
    prisma = globalAny.prisma;
    incidents = await import("../../src/lib/repository/incident.repository");
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it("creates, lists, and resolves incidents with tenant isolation", async () => {
    const companyA = await createTestCompany(prisma, { name: "Incident Co A" });
    const companyB = await createTestCompany(prisma, { name: "Incident Co B" });
    const siteA = await createTestSite(prisma, companyA.id, { name: "Site A" });
    const userA = await createTestUser(prisma, companyA.id);
    const signIn = await createTestSignInRecord(prisma, companyA.id, siteA.id, {
      visitorName: "Worker Incident",
    });

    const created = await incidents.createIncidentReport(companyA.id, {
      site_id: siteA.id,
      sign_in_record_id: signIn.id,
      incident_type: "NEAR_MISS",
      severity: "HIGH",
      title: "Dropped tool near walkway",
      description: "No injury, tool dropped from scaffold edge",
      immediate_actions: "Cleared zone and secured tools",
      reported_by: userA.id,
    });

    expect(created.company_id).toBe(companyA.id);
    expect(created.site_id).toBe(siteA.id);
    expect(created.sign_in_record_id).toBe(signIn.id);
    expect(created.status).toBe("OPEN");

    const listedA = await incidents.listIncidentReports(companyA.id);
    const listedB = await incidents.listIncidentReports(companyB.id);

    expect(listedA.total).toBe(1);
    expect(listedB.total).toBe(0);
    expect(listedA.items[0]?.title).toBe("Dropped tool near walkway");

    const resolved = await incidents.resolveIncidentReport(
      companyA.id,
      created.id,
      userA.id,
    );
    expect(resolved.status).toBe("CLOSED");
    expect(resolved.resolved_by).toBe(userA.id);
    expect(resolved.resolved_at).toBeTruthy();
  });

  it("rejects sign-in linkage when sign-in and site do not match", async () => {
    const company = await createTestCompany(prisma, { name: "Mismatch Co" });
    const siteA = await createTestSite(prisma, company.id, { name: "Site A" });
    const siteB = await createTestSite(prisma, company.id, { name: "Site B" });
    const signIn = await createTestSignInRecord(prisma, company.id, siteA.id, {
      visitorName: "Mismatch Worker",
    });

    await expect(
      incidents.createIncidentReport(company.id, {
        site_id: siteB.id,
        sign_in_record_id: signIn.id,
        title: "Mismatch test",
      }),
    ).rejects.toThrow(/selected site/i);
  });
});

