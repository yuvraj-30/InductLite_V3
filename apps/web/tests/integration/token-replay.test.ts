/**
 * Token Replay Attack Prevention Tests
 *
 * SECURITY: Validates that sign-out tokens cannot be reused.
 * Tests the atomic updateMany pattern with token hash revocation.
 *
 * These tests use real PostgreSQL via Testcontainers to verify:
 * - Tokens are invalidated after first use
 * - Concurrent replay attempts fail atomically
 * - Expired tokens are rejected
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
  createTestCompany,
  createTestSite,
  createTestTemplate,
} from "./setup";

// Types for dynamic imports
type SignOutTokenModule = typeof import("../../src/lib/auth/sign-out-token");
type PublicSigninRepo =
  typeof import("../../src/lib/repository/public-signin.repository");

describe("Token Replay Attack Prevention", () => {
  let prisma: PrismaClient;
  let company: { id: string; slug: string };
  let site: { id: string; name: string };

  // Dynamically imported modules
  let signOutToken: SignOutTokenModule;
  let publicSigninRepo: PublicSigninRepo;

  const globalAny = globalThis as unknown as { prisma: PrismaClient };

  beforeAll(async () => {
    await setupTestDatabase();
    prisma = globalAny.prisma;

    // Dynamic import AFTER database is set up
    signOutToken = await import("../../src/lib/auth/sign-out-token");
    publicSigninRepo =
      await import("../../src/lib/repository/public-signin.repository");
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    company = await createTestCompany(prisma);
    site = await createTestSite(prisma, company.id);
    // Create template for site (required for FK constraints)
    await createTestTemplate(prisma, company.id, site.id);
  });

  describe("Single-Use Token Enforcement", () => {
    it("should successfully sign out on first token use", async () => {
      const phone = "+64211234567";

      // Create a sign-in record with a valid token
      const { token, expiresAt } = signOutToken.generateSignOutToken(
        "temp",
        phone,
        3600000,
      );
      const tokenHash = signOutToken.hashSignOutToken(token);

      const signInRecord = await prisma.signInRecord.create({
        data: {
          company_id: company.id,
          site_id: site.id,
          visitor_name: "John Doe",
          visitor_phone: phone,
          visitor_type: "CONTRACTOR",
          sign_out_token: tokenHash,
          sign_out_token_exp: expiresAt,
        },
      });

      // Generate a fresh token for this actual record
      const { token: realToken, expiresAt: realExpiry } =
        signOutToken.generateSignOutToken(signInRecord.id, phone, 3600000);
      const realTokenHash = signOutToken.hashSignOutToken(realToken);

      // Update record with correct token
      await prisma.signInRecord.update({
        where: { id: signInRecord.id },
        data: {
          sign_out_token: realTokenHash,
          sign_out_token_exp: realExpiry,
        },
      });

      // First sign-out should succeed
      const result = await publicSigninRepo.signOutWithToken(realToken, phone);

      expect(result.success).toBe(true);
      expect(result.visitorName).toBe("John Doe");
    });

    it("createPublicSignIn end-to-end: generate token, sign out, and prevent replay", async () => {
      const phone = "+64211234567";

      // Create a template for this test
      const template = await createTestTemplate(prisma, company.id, site.id);

      // Create via repository (end-to-end)
      const created = await publicSigninRepo.createPublicSignIn({
        companyId: company.id,
        siteId: site.id,
        visitorName: "E2E User",
        visitorPhone: phone,
        templateId: template.id,
        templateVersion: template.version,
        answers: [{ questionId: "q1", answer: "yes" }],
        visitorType: "VISITOR",
      });

      // Sign out using returned token
      const first = await publicSigninRepo.signOutWithToken(
        created.signOutToken,
        phone,
      );
      expect(first.success).toBe(true);

      // Replay attempt should fail
      const second = await publicSigninRepo.signOutWithToken(
        created.signOutToken,
        phone,
      );
      expect(second.success).toBe(false);
      expect(second.error).toMatch(/already signed out/);

      // Verify token hash cleared in DB
      const rec = await prisma.signInRecord.findUnique({
        where: { id: created.signInRecordId },
      });
      expect(rec?.sign_out_token).toBeNull();
    });

    it("createPublicSignIn should fail when template does not exist (FK)", async () => {
      const phone = "+64211234567";

      await expect(
        publicSigninRepo.createPublicSignIn({
          companyId: company.id,
          siteId: site.id,
          visitorName: "Bad Template",
          visitorPhone: phone,
          templateId: "does-not-exist",
          templateVersion: 1,
          answers: [{ questionId: "q1", answer: "yes" }],
          visitorType: "VISITOR",
        }),
      ).rejects.toMatchObject({ name: "RepositoryError", code: "FOREIGN_KEY" });
    });

    it("createPublicSignIn should reject invalid templateVersion (integration)", async () => {
      const phone = "+64211234567";
      const template = await createTestTemplate(prisma, company.id, site.id);

      await expect(
        publicSigninRepo.createPublicSignIn({
          companyId: company.id,
          siteId: site.id,
          visitorName: "Bad Version",
          visitorPhone: phone,
          templateId: template.id,
          templateVersion: 0,
          answers: [{ questionId: "q1", answer: "yes" }],
          visitorType: "VISITOR",
        }),
      ).rejects.toThrow(/Invalid template version/);
    });

    it("createPublicSignIn should reject when template belongs to another company (tenant scoping)", async () => {
      // Create a second company and template
      const otherCompany = await createTestCompany(prisma);
      const otherSite = await createTestSite(prisma, otherCompany.id);
      const otherTemplate = await createTestTemplate(
        prisma,
        otherCompany.id,
        otherSite.id,
      );

      const phone = "+64211234567";

      await expect(
        publicSigninRepo.createPublicSignIn({
          companyId: company.id, // NOTE: using original company, but template belongs to otherCompany
          siteId: site.id,
          visitorName: "Cross Tenant",
          visitorPhone: phone,
          templateId: otherTemplate.id,
          templateVersion: otherTemplate.version,
          answers: [{ questionId: "q1", answer: "yes" }],
          visitorType: "VISITOR",
        }),
      ).rejects.toMatchObject({ name: "RepositoryError", code: "FORBIDDEN" });
    });

    it("createPublicSignIn should reject malformed phone (integration)", async () => {
      const phone = "bad-phone";
      const template = await createTestTemplate(prisma, company.id, site.id);

      await expect(
        publicSigninRepo.createPublicSignIn({
          companyId: company.id,
          siteId: site.id,
          visitorName: "Bad Phone",
          visitorPhone: phone,
          templateId: template.id,
          templateVersion: template.version,
          answers: [{ questionId: "q1", answer: "yes" }],
          visitorType: "VISITOR",
        }),
      ).rejects.toThrow(/Invalid phone number/);
    });

    it("createPublicSignIn should reject when template belongs to another company (integration)", async () => {
      // Create another company and template owned by them
      const otherCompany = await createTestCompany(prisma);
      const otherTemplate = await createTestTemplate(
        prisma,
        otherCompany.id,
        site.id,
      );

      const phone = "+64211234567";

      await expect(
        publicSigninRepo.createPublicSignIn({
          companyId: company.id, // NOT otherCompany
          siteId: site.id,
          visitorName: "Cross Tenant",
          visitorPhone: phone,
          templateId: otherTemplate.id,
          templateVersion: otherTemplate.version,
          answers: [{ questionId: "q1", answer: "yes" }],
          visitorType: "VISITOR",
        } as any),
      ).rejects.toMatchObject({ name: "RepositoryError", code: "FORBIDDEN" });
    });

    it("createPublicSignIn should reject unserializable answers (bad JSON)", async () => {
      const phone = "+64211234567";

      const template = await createTestTemplate(prisma, company.id, site.id);

      // Create circular answer that will fail JSON serialization
      const circular: any = {};
      circular.self = circular;

      await expect(
        publicSigninRepo.createPublicSignIn({
          companyId: company.id,
          siteId: site.id,
          visitorName: "Bad JSON",
          visitorPhone: phone,
          templateId: template.id,
          templateVersion: template.version,
          answers: [{ questionId: "q1", answer: circular }],
          visitorType: "VISITOR",
        }),
      ).rejects.toThrow(/circular/i);
    });

    it("should reject token on second use (replay attack)", async () => {
      const phone = "+64211234567";

      // Create sign-in record
      const signInRecord = await prisma.signInRecord.create({
        data: {
          company_id: company.id,
          site_id: site.id,
          visitor_name: "Jane Doe",
          visitor_phone: phone,
          visitor_type: "CONTRACTOR",
        },
      });

      // Generate and store token
      const { token, expiresAt } = signOutToken.generateSignOutToken(
        signInRecord.id,
        phone,
        3600000,
      );
      const tokenHash = signOutToken.hashSignOutToken(token);

      await prisma.signInRecord.update({
        where: { id: signInRecord.id },
        data: {
          sign_out_token: tokenHash,
          sign_out_token_exp: expiresAt,
        },
      });

      // First use - should succeed
      const firstResult = await publicSigninRepo.signOutWithToken(token, phone);
      expect(firstResult.success).toBe(true);

      // Second use (replay attack) - should fail
      const secondResult = await publicSigninRepo.signOutWithToken(
        token,
        phone,
      );
      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toContain("already signed out");
    });

    it("should clear token hash after successful sign-out", async () => {
      const phone = "+64211234567";

      const signInRecord = await prisma.signInRecord.create({
        data: {
          company_id: company.id,
          site_id: site.id,
          visitor_name: "Token Clear Test",
          visitor_phone: phone,
          visitor_type: "VISITOR",
        },
      });

      const { token, expiresAt } = signOutToken.generateSignOutToken(
        signInRecord.id,
        phone,
        3600000,
      );
      const tokenHash = signOutToken.hashSignOutToken(token);

      await prisma.signInRecord.update({
        where: { id: signInRecord.id },
        data: {
          sign_out_token: tokenHash,
          sign_out_token_exp: expiresAt,
        },
      });

      // Verify token exists before sign-out
      let record = await prisma.signInRecord.findUnique({
        where: { id: signInRecord.id },
      });
      expect(record?.sign_out_token).toBe(tokenHash);

      // Sign out
      await publicSigninRepo.signOutWithToken(token, phone);

      // Verify token hash is cleared
      record = await prisma.signInRecord.findUnique({
        where: { id: signInRecord.id },
      });
      expect(record?.sign_out_token).toBeNull();
      expect(record?.sign_out_token_exp).toBeNull();
    });
  });

  describe("Concurrent Replay Attack Prevention", () => {
    it("should only allow one concurrent sign-out to succeed", async () => {
      const phone = "+64211234567";

      const signInRecord = await prisma.signInRecord.create({
        data: {
          company_id: company.id,
          site_id: site.id,
          visitor_name: "Race Condition Test",
          visitor_phone: phone,
          visitor_type: "CONTRACTOR",
        },
      });

      const { token, expiresAt } = signOutToken.generateSignOutToken(
        signInRecord.id,
        phone,
        3600000,
      );
      const tokenHash = signOutToken.hashSignOutToken(token);

      await prisma.signInRecord.update({
        where: { id: signInRecord.id },
        data: {
          sign_out_token: tokenHash,
          sign_out_token_exp: expiresAt,
        },
      });

      // Fire multiple concurrent sign-out attempts
      const results = await Promise.all([
        publicSigninRepo.signOutWithToken(token, phone),
        publicSigninRepo.signOutWithToken(token, phone),
        publicSigninRepo.signOutWithToken(token, phone),
        publicSigninRepo.signOutWithToken(token, phone),
        publicSigninRepo.signOutWithToken(token, phone),
      ]);

      // Exactly one should succeed
      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBe(1);

      // All others should fail
      const failCount = results.filter((r) => !r.success).length;
      expect(failCount).toBe(4);
    });
  });

  describe("Expired Token Rejection", () => {
    it("should reject expired tokens", async () => {
      const phone = "+64211234567";

      const signInRecord = await prisma.signInRecord.create({
        data: {
          company_id: company.id,
          site_id: site.id,
          visitor_name: "Expired Token Test",
          visitor_phone: phone,
          visitor_type: "CONTRACTOR",
        },
      });

      // Generate a token that's already expired
      const { token } = signOutToken.generateSignOutToken(
        signInRecord.id,
        phone,
        -1000, // Expired 1 second ago
      );
      const tokenHash = signOutToken.hashSignOutToken(token);

      await prisma.signInRecord.update({
        where: { id: signInRecord.id },
        data: {
          sign_out_token: tokenHash,
          sign_out_token_exp: new Date(Date.now() - 1000), // Expired
        },
      });

      const result = await publicSigninRepo.signOutWithToken(token, phone);

      expect(result.success).toBe(false);
      expect(result.error).toContain("expired");
    });

    it("should accept tokens just before expiry", async () => {
      const phone = "+64211234567";

      const signInRecord = await prisma.signInRecord.create({
        data: {
          company_id: company.id,
          site_id: site.id,
          visitor_name: "Near Expiry Test",
          visitor_phone: phone,
          visitor_type: "CONTRACTOR",
        },
      });

      // Token expires in 1 hour
      const { token, expiresAt } = signOutToken.generateSignOutToken(
        signInRecord.id,
        phone,
        3600000,
      );
      const tokenHash = signOutToken.hashSignOutToken(token);

      await prisma.signInRecord.update({
        where: { id: signInRecord.id },
        data: {
          sign_out_token: tokenHash,
          sign_out_token_exp: expiresAt,
        },
      });

      const result = await publicSigninRepo.signOutWithToken(token, phone);
      expect(result.success).toBe(true);
    });
  });

  describe("Phone Mismatch Rejection", () => {
    it("should reject token with wrong phone number", async () => {
      const correctPhone = "+64211234567";
      const wrongPhone = "+64219999999";

      const signInRecord = await prisma.signInRecord.create({
        data: {
          company_id: company.id,
          site_id: site.id,
          visitor_name: "Phone Mismatch Test",
          visitor_phone: correctPhone,
          visitor_type: "CONTRACTOR",
        },
      });

      const { token, expiresAt } = signOutToken.generateSignOutToken(
        signInRecord.id,
        correctPhone,
        3600000,
      );
      const tokenHash = signOutToken.hashSignOutToken(token);

      await prisma.signInRecord.update({
        where: { id: signInRecord.id },
        data: {
          sign_out_token: tokenHash,
          sign_out_token_exp: expiresAt,
        },
      });

      // Try to sign out with wrong phone
      const result = await publicSigninRepo.signOutWithToken(token, wrongPhone);

      expect(result.success).toBe(false);
      // Token verification happens first, so signature will fail due to phone mismatch
    });
  });

  describe("Token Tampering Detection", () => {
    it("should reject modified token payload", async () => {
      const phone = "+64211234567";

      const signInRecord = await prisma.signInRecord.create({
        data: {
          company_id: company.id,
          site_id: site.id,
          visitor_name: "Tampering Test",
          visitor_phone: phone,
          visitor_type: "CONTRACTOR",
        },
      });

      const { token, expiresAt } = signOutToken.generateSignOutToken(
        signInRecord.id,
        phone,
        3600000,
      );
      const tokenHash = signOutToken.hashSignOutToken(token);

      await prisma.signInRecord.update({
        where: { id: signInRecord.id },
        data: {
          sign_out_token: tokenHash,
          sign_out_token_exp: expiresAt,
        },
      });

      // Tamper with the token (modify a character)
      const tamperedToken = token.slice(0, -1) + "X";

      const result = await publicSigninRepo.signOutWithToken(
        tamperedToken,
        phone,
      );

      expect(result.success).toBe(false);
    });

    it("should reject completely fabricated tokens", async () => {
      const phone = "+64211234567";

      await prisma.signInRecord.create({
        data: {
          company_id: company.id,
          site_id: site.id,
          visitor_name: "Fabrication Test",
          visitor_phone: phone,
          visitor_type: "CONTRACTOR",
        },
      });

      // Completely made-up token
      const fakeToken = "fake.token.value.here";

      const result = await publicSigninRepo.signOutWithToken(fakeToken, phone);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid");
    });
  });
});
