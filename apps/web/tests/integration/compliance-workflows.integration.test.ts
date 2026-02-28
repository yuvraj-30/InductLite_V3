import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
  createTestCompany,
  createTestSite,
  createTestUser,
} from "./setup";

type IncidentRepo = typeof import("../../src/lib/repository/incident.repository");
type EmergencyRepo = typeof import("../../src/lib/repository/emergency.repository");
type RetentionModule = typeof import("../../src/lib/maintenance/retention");

const DAY_MS = 24 * 60 * 60 * 1000;

describe("Compliance workflows integration", () => {
  let prisma: PrismaClient;
  let incidentRepo: IncidentRepo;
  let emergencyRepo: EmergencyRepo;
  let retention: RetentionModule;
  let company: { id: string };
  let site: { id: string };
  let user: { id: string };

  beforeAll(async () => {
    await setupTestDatabase();
    prisma = (globalThis as unknown as { prisma: PrismaClient }).prisma;
    incidentRepo = await import("../../src/lib/repository/incident.repository");
    emergencyRepo = await import("../../src/lib/repository/emergency.repository");
    retention = await import("../../src/lib/maintenance/retention");
  }, 120000);

  afterAll(async () => {
    await teardownTestDatabase();
  }, 120000);

  beforeEach(async () => {
    await cleanDatabase(prisma);
    company = await createTestCompany(prisma);
    site = await createTestSite(prisma, company.id);
    user = await createTestUser(prisma, company.id);
  });

  it("stores WorkSafe metadata and retention expiry for notifiable incidents", async () => {
    const occurredAt = new Date("2026-01-15T12:00:00.000Z");
    const worksafeNotifiedAt = new Date("2026-01-15T13:00:00.000Z");

    const incident = await incidentRepo.createIncidentReport(company.id, {
      site_id: site.id,
      title: "Excavation collapse",
      description: "Trench wall collapse with injury risk",
      severity: "CRITICAL",
      is_notifiable: true,
      worksafe_notified_at: worksafeNotifiedAt,
      worksafe_reference_number: "WS-2026-0001",
      worksafe_notified_by: user.id,
      legal_hold: true,
      occurred_at: occurredAt,
      reported_by: user.id,
    });

    expect(incident.is_notifiable).toBe(true);
    expect(incident.worksafe_notified_at?.toISOString()).toBe(
      worksafeNotifiedAt.toISOString(),
    );
    expect(incident.worksafe_reference_number).toBe("WS-2026-0001");
    expect(incident.worksafe_notified_by).toBe(user.id);
    expect(incident.legal_hold).toBe(true);
    expect(incident.retention_expires_at).toBeTruthy();
    expect(incident.retention_expires_at!.getTime()).toBeGreaterThan(
      occurredAt.getTime() + 1700 * DAY_MS,
    );
  });

  it("creates and lists emergency drill evidence records by site", async () => {
    const drill = await emergencyRepo.createEmergencyDrill(company.id, {
      site_id: site.id,
      drill_type: "FIRE",
      scenario: "Fire evacuation from workshop block",
      outcome_notes: "Evacuation completed in 4 minutes",
      follow_up_actions: "Replace missing extinguisher signage",
      tested_by: user.id,
      legal_hold: false,
      conducted_at: new Date("2026-02-10T00:00:00.000Z"),
      next_due_at: new Date("2027-02-10T00:00:00.000Z"),
    });

    const drills = await emergencyRepo.listEmergencyDrills(company.id, site.id);
    const listed = drills.find((entry) => entry.id === drill.id);

    expect(listed).toBeDefined();
    expect(listed?.drill_type).toBe("FIRE");
    expect(listed?.scenario).toContain("evacuation");
    expect(listed?.tested_by).toBe(user.id);
    expect(listed?.retention_expires_at).toBeTruthy();
  });

  it("purges expired non-held incidents and drills, preserving legal-hold records", async () => {
    const oldDate = new Date(Date.now() - 1900 * DAY_MS);

    const purgeIncident = await prisma.incidentReport.create({
      data: {
        company_id: company.id,
        site_id: site.id,
        title: "Old closed incident",
        status: "CLOSED",
        occurred_at: oldDate,
        legal_hold: false,
        retention_expires_at: new Date(Date.now() - DAY_MS),
      },
    });
    const heldIncident = await prisma.incidentReport.create({
      data: {
        company_id: company.id,
        site_id: site.id,
        title: "Held incident",
        status: "CLOSED",
        occurred_at: oldDate,
        legal_hold: true,
        retention_expires_at: new Date(Date.now() - DAY_MS),
      },
    });

    const purgeDrill = await prisma.emergencyDrill.create({
      data: {
        company_id: company.id,
        site_id: site.id,
        drill_type: "OTHER",
        scenario: "Old drill to purge",
        conducted_at: oldDate,
        legal_hold: false,
        retention_expires_at: new Date(Date.now() - DAY_MS),
      },
    });
    const heldDrill = await prisma.emergencyDrill.create({
      data: {
        company_id: company.id,
        site_id: site.id,
        drill_type: "OTHER",
        scenario: "Held drill",
        conducted_at: oldDate,
        legal_hold: true,
        retention_expires_at: new Date(Date.now() - DAY_MS),
      },
    });

    await retention.runRetentionTasks();

    const [purgedIncidentAfter, heldIncidentAfter, purgedDrillAfter, heldDrillAfter] =
      await Promise.all([
        prisma.incidentReport.findFirst({ where: { id: purgeIncident.id } }),
        prisma.incidentReport.findFirst({ where: { id: heldIncident.id } }),
        prisma.emergencyDrill.findFirst({ where: { id: purgeDrill.id } }),
        prisma.emergencyDrill.findFirst({ where: { id: heldDrill.id } }),
      ]);

    expect(purgedIncidentAfter).toBeNull();
    expect(heldIncidentAfter).not.toBeNull();
    expect(purgedDrillAfter).toBeNull();
    expect(heldDrillAfter).not.toBeNull();
  });

  it("preserves sign-in and audit evidence when company compliance legal hold is active", async () => {
    const oldDate = new Date(Date.now() - 500 * DAY_MS);

    await prisma.company.update({
      where: { id: company.id },
      data: {
        retention_days: 30,
        induction_retention_days: 30,
        audit_retention_days: 30,
        compliance_legal_hold: true,
      },
    });

    const heldSignIn = await prisma.signInRecord.create({
      data: {
        company_id: company.id,
        site_id: site.id,
        visitor_name: "Held Visitor",
        visitor_phone: "0210000000",
        visitor_type: "CONTRACTOR",
        sign_in_ts: oldDate,
        sign_out_ts: oldDate,
      },
    });

    const heldAudit = await prisma.auditLog.create({
      data: {
        company_id: company.id,
        action: "incident.create",
        entity_type: "IncidentReport",
        entity_id: "held-incident",
        created_at: oldDate,
      },
    });

    await retention.runRetentionTasks();

    const [heldSignInAfter, heldAuditAfter] = await Promise.all([
      prisma.signInRecord.findFirst({ where: { id: heldSignIn.id } }),
      prisma.auditLog.findFirst({ where: { id: heldAudit.id } }),
    ]);

    expect(heldSignInAfter).not.toBeNull();
    expect(heldAuditAfter).not.toBeNull();
  });
});
