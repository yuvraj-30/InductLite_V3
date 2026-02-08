import { describe, it, expect, beforeEach } from "vitest";
/* @vitest-environment node */
import { publicDb } from "../../../lib/db/public-db";
import {
  publishTemplate,
  createTemplate,
  createNewVersion,
} from "../../repository/template.repository";

// Verify we can actually reach the DB at test startup; when running coverage
// or certain CI steps the DB may not be available evens if ALLOW_TEST_RUNNER=1
let canConnectToDb = false;
await (async () => {
  try {
    await publicDb.company.findFirst();
    canConnectToDb = true;
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn("DB unavailable for integration tests:", err?.message ?? err);
  }
})();

describe("Template Versioning & Re-induction Integration", () => {
  const companyId = "test-company-versioning";

  beforeEach(async () => {
    // Skip DB cleanup when test runner isn't allowed to use the DB (unit CI jobs)
    if (process.env.ALLOW_TEST_RUNNER !== "1") {
      return;
    }

    // Cleanup
    await publicDb.inductionResponse.deleteMany({
      where: { template: { company_id: companyId } },
    });
    await publicDb.inductionQuestion.deleteMany({
      where: { template: { company_id: companyId } },
    });
    await publicDb.inductionTemplate.deleteMany({
      where: { company_id: companyId },
    });
    await publicDb.site.deleteMany({
      where: { company_id: companyId },
    });
    await publicDb.company.upsert({
      where: { id: companyId },
      create: { id: companyId, name: "Test Co", slug: "test-co-versioning" },
      update: {},
    });
  });

  const itIfDB = process.env.ALLOW_TEST_RUNNER === "1" && canConnectToDb ? it : it.skip;

  itIfDB(
    "should invalidate old records when forceReinduction is true",
    async () => {
      // 1. Create a site
      const site = await publicDb.site.create({
        data: { company_id: companyId, name: "VRT Site" },
      });

      // 2. Create and publish V1
      const t1 = await createTemplate(companyId, {
        name: "Safety Induction",
        site_id: site.id,
      });

      await publicDb.inductionQuestion.create({
        data: {
          template_id: t1.id,
          question_text: "Test?",
          question_type: "YES_NO",
          display_order: 1,
        },
      });

      await publishTemplate(companyId, t1.id, false);

      // 3. Create a sign-in and response for V1
      const signIn = await publicDb.signInRecord.create({
        data: {
          company_id: companyId,
          site_id: site.id,
          visitor_name: "Old Worker",
          visitor_phone: "123",
          visitor_type: "CONTRACTOR",
        },
      });

      await publicDb.inductionResponse.create({
        data: {
          sign_in_record_id: signIn.id,
          template_id: t1.id,
          template_version: 1,
          answers: [],
          passed: true,
        },
      });

      // Verify initial state
      const initialResp = await publicDb.inductionResponse.findFirst({
        where: { sign_in_record_id: signIn.id },
      });
      expect(initialResp?.passed).toBe(true);

      // 4. Create V2 and publish with forceReinduction: true
      const t2 = await createNewVersion(companyId, t1.id);
      await publishTemplate(companyId, t2.id, true);

      // 5. Verify old response is now "invalidated" (passed: false)
      const updatedResp = await publicDb.inductionResponse.findFirst({
        where: { sign_in_record_id: signIn.id },
      });
      expect(updatedResp?.passed).toBe(false);
    },
  );
});
