import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  cleanDatabase,
  createTestCompany,
  createTestSite,
  createTestTemplate,
  setupTestDatabase,
  teardownTestDatabase,
} from "./setup";

type LegalHelpers = typeof import("../../src/lib/legal/consent-versioning");
type PublicSignInRepository = typeof import("../../src/lib/repository/public-signin.repository");

describe("Legal consent and signature persistence integration", () => {
  let prisma: PrismaClient;
  let legal: LegalHelpers;
  let publicSignIn: PublicSignInRepository;

  const globalAny = globalThis as unknown as { prisma: PrismaClient };

  beforeAll(async () => {
    await setupTestDatabase();
    prisma = globalAny.prisma;
    legal = await import("../../src/lib/legal/consent-versioning");
    publicSignIn = await import("../../src/lib/repository/public-signin.repository");
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it("auto-provisions legal versions and stores signature evidence metadata", async () => {
    const company = await createTestCompany(prisma, { name: "Legal Co" });
    const site = await createTestSite(prisma, company.id, { name: "Legal Site" });
    const template = await createTestTemplate(prisma, company.id, site.id);
    await prisma.inductionQuestion.create({
      data: {
        template_id: template.id,
        question_text: "Do you understand the emergency process?",
        question_type: "YES_NO",
        is_required: true,
        display_order: 1,
      },
    });

    const activeLegal = await legal.getOrCreateActiveLegalVersions(company.id);
    const activeLegalAgain = await legal.getOrCreateActiveLegalVersions(company.id);

    expect(activeLegal.terms.version).toBe(1);
    expect(activeLegal.privacy.version).toBe(1);
    expect(activeLegalAgain.terms.id).toBe(activeLegal.terms.id);
    expect(activeLegalAgain.privacy.id).toBe(activeLegal.privacy.id);

    const signatureData =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBgJ0nYwAAAABJRU5ErkJggg==";

    const result = await publicSignIn.createPublicSignIn({
      companyId: company.id,
      siteId: site.id,
      idempotencyKey: "integration-legal-signature-key",
      visitorName: "Legal Visitor",
      visitorPhone: "021 123 4567",
      visitorType: "CONTRACTOR",
      hasAcceptedTerms: true,
      templateId: template.id,
      templateVersion: template.version,
      answers: [{ questionId: "q1", answer: true }],
      signatureData,
      termsVersionId: activeLegal.terms.id,
      privacyVersionId: activeLegal.privacy.id,
      consentStatement: legal.buildConsentStatement({ siteName: site.name }),
    });

    const persistedSignIn = await prisma.signInRecord.findFirst({
      where: { id: result.signInRecordId },
    });
    const persistedInduction = await prisma.inductionResponse.findFirst({
      where: { sign_in_record_id: result.signInRecordId },
    });

    expect(persistedSignIn?.terms_version_id).toBe(activeLegal.terms.id);
    expect(persistedSignIn?.privacy_version_id).toBe(activeLegal.privacy.id);
    expect(persistedSignIn?.consent_statement).toContain("site safety");

    expect(persistedInduction?.signature_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(persistedInduction?.signature_mime_type).toBe("image/png");
    expect((persistedInduction?.signature_size_bytes ?? 0) > 0).toBe(true);
    expect(persistedInduction?.signature_captured_at).toBeTruthy();
    expect(persistedInduction?.signature_url).toBeTruthy();
    expect(persistedInduction?.completion_snapshot).toBeTruthy();
    expect(persistedInduction?.competency_status).toBe("SELF_DECLARED");
    expect(persistedInduction?.briefing_acknowledged_at).toBeTruthy();
    expect(persistedInduction?.supervisor_verified_by).toBeNull();
    expect(persistedInduction?.supervisor_verified_at).toBeNull();

    const snapshot = persistedInduction?.completion_snapshot as {
      legal?: { terms_version_id?: string; privacy_version_id?: string };
      template?: { version?: number; questions?: Array<{ id: string }> };
      signature?: { hash?: string };
      competency?: {
        status?: string;
        briefing_acknowledged_at?: string;
        refresher_status?: string;
        supervisor_verified_by?: string | null;
      };
    };

    expect(snapshot.legal?.terms_version_id).toBe(activeLegal.terms.id);
    expect(snapshot.legal?.privacy_version_id).toBe(activeLegal.privacy.id);
    expect(snapshot.template?.version).toBe(template.version);
    expect((snapshot.template?.questions?.length ?? 0) > 0).toBe(true);
    expect(snapshot.signature?.hash).toBe(persistedInduction?.signature_hash ?? undefined);
    expect(snapshot.competency?.status).toBe("SELF_DECLARED");
    expect(snapshot.competency?.briefing_acknowledged_at).toBeTruthy();
    expect(snapshot.competency?.refresher_status).toBe("NOT_SCHEDULED");
    expect(snapshot.competency?.supervisor_verified_by).toBeNull();
  });
});
