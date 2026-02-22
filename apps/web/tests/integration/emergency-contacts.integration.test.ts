import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  cleanDatabase,
  createTestCompany,
  createTestSite,
  setupTestDatabase,
  teardownTestDatabase,
} from "./setup";

type EmergencyRepository = typeof import("../../src/lib/repository/emergency.repository");

describe("Emergency repository integration", () => {
  let prisma: PrismaClient;
  let emergency: EmergencyRepository;

  const globalAny = globalThis as unknown as { prisma: PrismaClient };

  beforeAll(async () => {
    await setupTestDatabase();
    prisma = globalAny.prisma;
    emergency = await import("../../src/lib/repository/emergency.repository");
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it("stores emergency contacts and procedures scoped to site and company", async () => {
    const companyA = await createTestCompany(prisma, { name: "Company A" });
    const companyB = await createTestCompany(prisma, { name: "Company B" });
    const siteA = await createTestSite(prisma, companyA.id, { name: "Main Site" });

    const contact = await emergency.createSiteEmergencyContact(companyA.id, {
      site_id: siteA.id,
      name: "Mara Safety",
      role: "Site Manager",
      phone: "021 123 4567",
      email: "mara@example.test",
      priority: 1,
    });

    const procedure = await emergency.createSiteEmergencyProcedure(companyA.id, {
      site_id: siteA.id,
      title: "Evacuate to muster point",
      instructions: "Proceed to the east gate muster point immediately.",
      sort_order: 1,
    });

    const contactsA = await emergency.listSiteEmergencyContacts(companyA.id, siteA.id);
    const contactsB = await emergency.listSiteEmergencyContacts(companyB.id, siteA.id);
    const proceduresA = await emergency.listSiteEmergencyProcedures(companyA.id, siteA.id);

    expect(contactsA).toHaveLength(1);
    expect(contactsB).toHaveLength(0);
    expect(proceduresA).toHaveLength(1);
    expect(contactsA[0]?.id).toBe(contact.id);
    expect(proceduresA[0]?.id).toBe(procedure.id);

    await emergency.deactivateSiteEmergencyContact(companyA.id, contact.id);
    await emergency.deactivateSiteEmergencyProcedure(companyA.id, procedure.id);

    const contactsAfterDeactivate = await emergency.listSiteEmergencyContacts(
      companyA.id,
      siteA.id,
    );
    const proceduresAfterDeactivate = await emergency.listSiteEmergencyProcedures(
      companyA.id,
      siteA.id,
    );

    expect(contactsAfterDeactivate).toHaveLength(0);
    expect(proceduresAfterDeactivate).toHaveLength(0);
  });
});
