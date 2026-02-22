import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  cleanDatabase,
  createTestCompany,
  createTestSite,
  createTestUser,
  setupTestDatabase,
  teardownTestDatabase,
} from "./setup";

type HazardRepository = typeof import("../../src/lib/repository/hazard.repository");

describe("Hazard register repository integration", () => {
  let prisma: PrismaClient;
  let hazards: HazardRepository;

  const globalAny = globalThis as unknown as { prisma: PrismaClient };

  beforeAll(async () => {
    await setupTestDatabase();
    prisma = globalAny.prisma;
    hazards = await import("../../src/lib/repository/hazard.repository");
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it("creates, lists, and closes hazards with tenant isolation", async () => {
    const companyA = await createTestCompany(prisma, { name: "Company A" });
    const companyB = await createTestCompany(prisma, { name: "Company B" });
    const siteA = await createTestSite(prisma, companyA.id, { name: "Site A" });
    const userA = await createTestUser(prisma, companyA.id);

    const created = await hazards.createHazard(companyA.id, {
      site_id: siteA.id,
      title: "Unprotected trench",
      description: "Trench edge is open near access path",
      risk_level: "HIGH",
      identified_by: userA.id,
    });

    expect(created.company_id).toBe(companyA.id);
    expect(created.status).toBe("OPEN");

    const listedA = await hazards.listHazards(companyA.id, { site_id: siteA.id });
    const listedB = await hazards.listHazards(companyB.id);

    expect(listedA.total).toBe(1);
    expect(listedB.total).toBe(0);
    expect(listedA.items[0]?.title).toBe("Unprotected trench");

    const closed = await hazards.closeHazard(companyA.id, created.id, userA.id);
    expect(closed.status).toBe("CLOSED");
    expect(closed.closed_by).toBe(userA.id);
    expect(closed.closed_at).toBeTruthy();
  });
});
