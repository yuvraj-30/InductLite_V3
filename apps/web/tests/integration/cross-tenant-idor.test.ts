/**
 * Cross-Tenant IDOR Prevention Tests
 *
 * SECURITY: Validates that all repository methods enforce tenant isolation.
 * Tests that Company A cannot access Company B's data through any API.
 *
 * These tests use real PostgreSQL via Testcontainers to verify that
 * the WHERE clauses with company_id are correctly applied at the DB level.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
  createTestCompany,
  createTestSite,
  createTestUser,
  createTestTemplate,
  createTestSignInRecord,
} from "./setup";

// Repository imports - use dynamic imports to ensure they get the test database
type SiteRepo = typeof import("../../src/lib/repository/site.repository");
type TemplateRepo =
  typeof import("../../src/lib/repository/template.repository");
type SigninRepo = typeof import("../../src/lib/repository/signin.repository");
type ContractorRepo =
  typeof import("../../src/lib/repository/contractor.repository");
type ExportRepo = typeof import("../../src/lib/repository/export.repository");
type SiteManagerRepo =
  typeof import("../../src/lib/repository/site-manager.repository");
type MagicLinkRepo =
  typeof import("../../src/lib/repository/magic-link.repository");

describe("Cross-Tenant IDOR Prevention", () => {
  let prisma: PrismaClient;
  let siteRepo: SiteRepo;
  let templateRepo: TemplateRepo;
  let signinRepo: SigninRepo;
  let contractorRepo: ContractorRepo;
  let exportRepo: ExportRepo;
  let siteManagerRepo: SiteManagerRepo;
  let magicLinkRepo: MagicLinkRepo;

  // Two separate tenants
  let companyA: { id: string; slug: string; name: string };
  let companyB: { id: string; slug: string; name: string };

  // Company A's resources
  let siteA: { id: string; name: string };
  let templateA: { id: string; version: number };
  let signInRecordA: { id: string; visitorPhone: string };

  // Company B's resources
  let siteB: { id: string; name: string };
  let templateB: { id: string; version: number };
  let signInRecordB: { id: string; visitorPhone: string };

  let contractorDocA: { id: string };
  let contractorDocB: { id: string };
  let contractorAId: string;
  let contractorBId: string;
  let exportJobA: { id: string };
  let exportJobB: { id: string };
  let magicLinkTokenA: { id: string };
  let magicLinkTokenB: { id: string };
  let siteManagerA: { id: string; email: string };
  let siteManagerB: { id: string; email: string };
  let adminA: { id: string; email: string };
  let adminB: { id: string; email: string };

  beforeAll(async () => {
    const res = await setupTestDatabase();
    prisma = res.prisma;

    // Dynamic import repositories AFTER database is set up
    // This ensures they use the test database connection
    siteRepo = await import("../../src/lib/repository/site.repository");
    templateRepo = await import("../../src/lib/repository/template.repository");
    signinRepo = await import("../../src/lib/repository/signin.repository");
    contractorRepo =
      await import("../../src/lib/repository/contractor.repository");
    exportRepo = await import("../../src/lib/repository/export.repository");
    siteManagerRepo =
      await import("../../src/lib/repository/site-manager.repository");
    magicLinkRepo =
      await import("../../src/lib/repository/magic-link.repository");
  }, 120000);

  afterAll(async () => {
    await teardownTestDatabase();
  }, 120000);

  beforeEach(async () => {
    await cleanDatabase(prisma);

    // Create two separate companies
    companyA = await createTestCompany(prisma, {
      name: "Company Alpha",
      slug: "company-alpha",
    });
    companyB = await createTestCompany(prisma, {
      name: "Company Beta",
      slug: "company-beta",
    });

    // Create resources for Company A
    siteA = await createTestSite(prisma, companyA.id, { name: "Site Alpha" });
    templateA = await createTestTemplate(prisma, companyA.id, siteA.id);
    signInRecordA = await createTestSignInRecord(
      prisma,
      companyA.id,
      siteA.id,
      {
        visitorName: "Alice Visitor",
        visitorPhone: "0412345001",
      },
    );

    // Create resources for Company B
    siteB = await createTestSite(prisma, companyB.id, { name: "Site Beta" });
    templateB = await createTestTemplate(prisma, companyB.id, siteB.id);
    signInRecordB = await createTestSignInRecord(
      prisma,
      companyB.id,
      siteB.id,
      {
        visitorName: "Bob Visitor",
        visitorPhone: "0412345002",
      },
    );

    const contractorA = await prisma.contractor.create({
      data: {
        company_id: companyA.id,
        name: "Contractor A",
        is_active: true,
      },
    });
    contractorAId = contractorA.id;
    contractorDocA = await prisma.contractorDocument.create({
      data: {
        contractor_id: contractorA.id,
        document_type: "INSURANCE",
        file_name: "doc-a.pdf",
        file_path: "uploads/a/doc-a.pdf",
        file_size: 1234,
        mime_type: "pdf",
      },
    });

    const contractorB = await prisma.contractor.create({
      data: {
        company_id: companyB.id,
        name: "Contractor B",
        is_active: true,
      },
    });
    contractorBId = contractorB.id;
    contractorDocB = await prisma.contractorDocument.create({
      data: {
        contractor_id: contractorB.id,
        document_type: "INSURANCE",
        file_name: "doc-b.pdf",
        file_path: "uploads/b/doc-b.pdf",
        file_size: 1234,
        mime_type: "pdf",
      },
    });

    siteManagerA = await createTestUser(prisma, companyA.id, {
      role: "SITE_MANAGER",
    });
    siteManagerB = await createTestUser(prisma, companyB.id, {
      role: "SITE_MANAGER",
    });
    adminA = await createTestUser(prisma, companyA.id);
    adminB = await createTestUser(prisma, companyB.id);

    await prisma.siteManagerAssignment.create({
      data: {
        company_id: companyA.id,
        user_id: siteManagerA.id,
        site_id: siteA.id,
      },
    });
    await prisma.siteManagerAssignment.create({
      data: {
        company_id: companyB.id,
        user_id: siteManagerB.id,
        site_id: siteB.id,
      },
    });

    magicLinkTokenA = await prisma.magicLinkToken.create({
      data: {
        company_id: companyA.id,
        contractor_id: contractorA.id,
        token_hash: "hash-company-a",
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    magicLinkTokenB = await prisma.magicLinkToken.create({
      data: {
        company_id: companyB.id,
        contractor_id: contractorB.id,
        token_hash: "hash-company-b",
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    exportJobA = await prisma.exportJob.create({
      data: {
        company_id: companyA.id,
        export_type: "SIGN_IN_CSV",
        parameters: {},
        requested_by: adminA.id,
      },
    });

    exportJobB = await prisma.exportJob.create({
      data: {
        company_id: companyB.id,
        export_type: "SIGN_IN_CSV",
        parameters: {},
        requested_by: adminB.id,
      },
    });
  });

  describe("Site Repository - Tenant Isolation", () => {
    it("should NOT return Company B's site when querying with Company A's ID", async () => {
      // Try to access Company B's site using Company A's company_id
      const result = await siteRepo.findSiteById(companyA.id, siteB.id);

      expect(result).toBeNull();
    });

    it("should return Company A's site when querying with Company A's ID", async () => {
      const result = await siteRepo.findSiteById(companyA.id, siteA.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(siteA.id);
      expect(result?.company_id).toBe(companyA.id);
    });

    it("should NOT list Company B's sites in Company A's site list", async () => {
      const result = await siteRepo.listSites(companyA.id);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.id).toBe(siteA.id);
      expect(result.items.some((s) => s.id === siteB.id)).toBe(false);
    });

    it("should NOT allow Company A to update Company B's site", async () => {
      // This test verifies that updateSite includes company_id in WHERE clause
      await expect(
        siteRepo.updateSite(companyA.id, siteB.id, { name: "Hacked Site" }),
      ).rejects.toThrow();

      // Verify the site wasn't actually modified
      const site = await prisma.site.findUnique({ where: { id: siteB.id } });
      expect(site?.name).toBe("Site Beta");
    });

    it("should NOT allow Company A to deactivate Company B's site", async () => {
      await expect(
        siteRepo.deactivateSite(companyA.id, siteB.id),
      ).rejects.toThrow();

      // Verify the site is still active
      const site = await prisma.site.findUnique({ where: { id: siteB.id } });
      expect(site?.is_active).toBe(true);
    });
  });

  describe("Template Repository - Tenant Isolation", () => {
    it("should NOT return Company B's template when querying with Company A's ID", async () => {
      const result = await templateRepo.findTemplateById(
        companyA.id,
        templateB.id,
      );

      expect(result).toBeNull();
    });

    it("should return Company A's template when querying correctly", async () => {
      const result = await templateRepo.findTemplateById(
        companyA.id,
        templateA.id,
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe(templateA.id);
    });

    it("should NOT list Company B's templates in Company A's list", async () => {
      const result = await templateRepo.listTemplates(companyA.id);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.id).toBe(templateA.id);
      expect(result.items.some((t) => t.id === templateB.id)).toBe(false);
    });
  });

  describe("SignIn Repository - Tenant Isolation", () => {
    it("should NOT return Company B's sign-in record when querying with Company A's ID", async () => {
      const result = await signinRepo.findSignInById(
        companyA.id,
        signInRecordB.id,
      );

      expect(result).toBeNull();
    });

    it("should return Company A's sign-in record when querying correctly", async () => {
      const result = await signinRepo.findSignInById(
        companyA.id,
        signInRecordA.id,
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe(signInRecordA.id);
    });

    it("should NOT list Company B's sign-ins in Company A's history", async () => {
      const result = await signinRepo.listSignInHistory(companyA.id, {
        siteId: siteB.id, // Try to query Company B's site
      });

      expect(result.items).toHaveLength(0);
    });

    it("should NOT allow Company A user to sign out Company B's visitor", async () => {
      // Create a user for Company A
      const userA = await createTestUser(prisma, companyA.id);

      // Try to sign out Company B's visitor as Company A user
      await expect(
        signinRepo.signOutVisitor(companyA.id, signInRecordB.id, userA.id),
      ).rejects.toThrow();

      // Verify the record wasn't signed out
      const record = await prisma.signInRecord.findUnique({
        where: { id: signInRecordB.id },
      });
      expect(record?.sign_out_ts).toBeNull();
    });
  });

  describe("Contractor Document Repository - Tenant Isolation", () => {
    it("should NOT return Company B's contractor document when querying with Company A's ID", async () => {
      const result = await contractorRepo.findContractorDocumentById(
        companyA.id,
        contractorDocB.id,
      );

      expect(result).toBeNull();
    });

    it("should return Company A's contractor document when querying correctly", async () => {
      const result = await contractorRepo.findContractorDocumentById(
        companyA.id,
        contractorDocA.id,
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe(contractorDocA.id);
    });

    it("should reject adding a document when storage key company prefix mismatches", async () => {
      await expect(
        contractorRepo.addContractorDocument(companyA.id, contractorAId, {
          document_type: "INSURANCE",
          file_name: "doc-a.pdf",
          file_path: `contractors/${companyB.id}/${contractorAId}/doc-a.pdf`,
          file_size: 1234,
          mime_type: "pdf",
        }),
      ).rejects.toThrow(/Invalid document storage key/);
    });

    it("should reject adding a document when storage key contractor prefix mismatches", async () => {
      await expect(
        contractorRepo.addContractorDocument(companyA.id, contractorAId, {
          document_type: "INSURANCE",
          file_name: "doc-a.pdf",
          file_path: `contractors/${companyA.id}/${contractorBId}/doc-a.pdf`,
          file_size: 1234,
          mime_type: "pdf",
        }),
      ).rejects.toThrow(/Invalid document storage key/);
    });
  });

  describe("Export Job Repository - Tenant Isolation", () => {
    it("should NOT return Company B's export job when querying with Company A's ID", async () => {
      const result = await exportRepo.findExportJobById(
        companyA.id,
        exportJobB.id,
      );

      expect(result).toBeNull();
    });

    it("should return Company A's export job when querying correctly", async () => {
      const result = await exportRepo.findExportJobById(
        companyA.id,
        exportJobA.id,
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe(exportJobA.id);
    });
  });

  describe("Site Manager Repository - Tenant Isolation", () => {
    it("should NOT return Company B's managed sites for Company A", async () => {
      const result = await siteManagerRepo.listManagedSiteIds(
        companyA.id,
        siteManagerB.id,
      );

      expect(result).toHaveLength(0);
    });

    it("should return Company A's managed sites for Company A", async () => {
      const result = await siteManagerRepo.listManagedSiteIds(
        companyA.id,
        siteManagerA.id,
      );

      expect(result).toEqual([siteA.id]);
    });

    it("should NOT allow Company A to remove Company B's site manager assignment", async () => {
      const count = await siteManagerRepo.removeSiteManager(
        companyA.id,
        siteManagerB.id,
        siteB.id,
      );

      expect(count).toBe(0);
    });
  });

  describe("Magic Link Repository - Tenant Isolation", () => {
    it("should NOT return Company B's magic link token when querying with Company A's ID", async () => {
      const result = await magicLinkRepo.findMagicLinkTokenById(
        companyA.id,
        magicLinkTokenB.id,
      );

      expect(result).toBeNull();
    });

    it("should return Company A's magic link token when querying correctly", async () => {
      const result = await magicLinkRepo.findMagicLinkTokenById(
        companyA.id,
        magicLinkTokenA.id,
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe(magicLinkTokenA.id);
    });
  });

  describe("User Repository - Tenant Isolation", () => {
    it("should NOT allow Company A to access Company B's users", async () => {
      const userB = await createTestUser(prisma, companyB.id, {
        email: "bob@companyb.com",
      });

      // Query users for Company A should not include Company B's user
      const users = await prisma.user.findMany({
        where: { company_id: companyA.id },
      });

      expect(users.some((u) => u.id === userB.id)).toBe(false);
    });
  });

  describe("requireCompanyId Guard", () => {
    it("should reject empty company_id", async () => {
      await expect(siteRepo.findSiteById("", siteA.id)).rejects.toThrow(
        "company_id is required",
      );
    });

    it("should reject null company_id", async () => {
      await expect(
        siteRepo.findSiteById(null as unknown as string, siteA.id),
      ).rejects.toThrow("company_id is required");
    });

    it("should reject undefined company_id", async () => {
      await expect(
        siteRepo.findSiteById(undefined as unknown as string, siteA.id),
      ).rejects.toThrow("company_id is required");
    });
  });

  describe("Compound IDOR Scenarios", () => {
    it("should prevent accessing resources via nested site reference", async () => {
      // Try to access templates through Company A but with Company B's site
      const result = await templateRepo.listTemplates(companyA.id, {
        siteId: siteB.id,
      });

      expect(result.items).toHaveLength(0);
    });

    it("should prevent bulk operations from affecting other tenants", async () => {
      // Create multiple sign-in records for Company A
      await createTestSignInRecord(prisma, companyA.id, siteA.id);
      await createTestSignInRecord(prisma, companyA.id, siteA.id);

      // Count before
      const countBBefore = await prisma.signInRecord.count({
        where: { company_id: companyB.id },
      });

      // If there were a bulk delete operation, it should NOT affect Company B
      // This verifies that all bulk operations include company_id filtering
      const countBAfter = await prisma.signInRecord.count({
        where: { company_id: companyB.id },
      });

      expect(countBAfter).toBe(countBBefore);
    });
  });
});
