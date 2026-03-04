import { NextResponse } from "next/server";
import { PrismaClient, QuestionType } from "@prisma/client";
import { __test_clearInMemoryStore } from "@/lib/rate-limit";
import { ensureTestRouteAccess } from "../_guard";
import { hashGeofenceOverrideCode } from "@/lib/access-control/config";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const accessDenied = ensureTestRouteAccess(req);
  if (accessDenied) return accessDenied;

  try {
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const slugPrefix = (body.slugPrefix as string) ?? "test-site-e2e";
    const companySlugParam = String(body.companySlug ?? "").trim();
    const includeRedFlagQuestion =
      body.includeRedFlagQuestion === true ||
      body.includeRedFlagQuestion === "true" ||
      body.includeRedFlagQuestion === 1 ||
      body.includeRedFlagQuestion === "1";
    const includeLanguageVariants =
      body.includeLanguageVariants === true ||
      body.includeLanguageVariants === "true" ||
      body.includeLanguageVariants === 1 ||
      body.includeLanguageVariants === "1";
    const includeMediaQuizFlow =
      body.includeMediaQuizFlow === true ||
      body.includeMediaQuizFlow === "true" ||
      body.includeMediaQuizFlow === 1 ||
      body.includeMediaQuizFlow === "1";
    const includeGeofenceOverrideFlow =
      body.includeGeofenceOverrideFlow === true ||
      body.includeGeofenceOverrideFlow === "true" ||
      body.includeGeofenceOverrideFlow === 1 ||
      body.includeGeofenceOverrideFlow === "1";

    const siteFeatureOverrides: Record<string, boolean> = {};
    if (includeLanguageVariants) {
      siteFeatureOverrides.MULTI_LANGUAGE = true;
    }
    if (includeMediaQuizFlow) {
      siteFeatureOverrides.QUIZ_SCORING_V2 = true;
      siteFeatureOverrides.CONTENT_BLOCKS = true;
    }
    if (includeGeofenceOverrideFlow) {
      siteFeatureOverrides.GEOFENCE_ENFORCEMENT = true;
    }
    // Use a random suffix to avoid collisions when running tests in parallel locally
    const suffix = Math.random().toString(36).slice(2, 8);
    const slug = `${slugPrefix}-${suffix}`;

    // Find or create a company to own the site.
    const company = companySlugParam
      ? ((await prisma.company.findUnique({
          where: { slug: companySlugParam },
        })) ??
        (await prisma.company.create({
          data: {
            name: `E2E Company ${companySlugParam}`,
            slug: companySlugParam,
            retention_days: 365,
          },
        })))
      : ((await prisma.company.findFirst({ where: { slug: "buildright-nz" } })) ??
        (await prisma.company.create({
          data: {
            name: "E2E Company",
            slug: `e2e-${suffix}`,
            retention_days: 365,
          },
        })));

    // Create site
    const site = await prisma.site.create({
      data: {
        company_id: company.id,
        name: `E2E Site ${suffix}`,
        address: "",
        description: "Temporary E2E site",
        location_latitude: includeGeofenceOverrideFlow ? -36.8485 : null,
        location_longitude: includeGeofenceOverrideFlow ? 174.7633 : null,
        location_radius_m: includeGeofenceOverrideFlow ? 120 : null,
        access_control: includeGeofenceOverrideFlow
          ? {
              version: 1,
              geofence: {
                mode: "OVERRIDE",
                allowMissingLocation: false,
                overrideCodeHash: hashGeofenceOverrideCode("123456"),
                updatedAt: new Date().toISOString(),
              },
              hardware: {
                enabled: false,
                provider: null,
                endpointUrl: null,
                authToken: null,
                updatedAt: null,
              },
            }
          : undefined,
        is_active: true,
        feature_overrides:
          Object.keys(siteFeatureOverrides).length > 0
            ? siteFeatureOverrides
            : undefined,
      },
    });

    // Create public link (slug)
    const publicLink = await prisma.sitePublicLink.create({
      data: {
        site_id: site.id,
        slug,
        is_active: true,
      },
    });

    // Create a minimal induction template for the site (published)
    const template = await prisma.inductionTemplate.create({
      data: {
        company_id: company.id,
        site_id: site.id,
        name: `E2E Template ${suffix}`,
        description: "Temporary e2e template",
        version: 1,
        is_published: true,
        published_at: new Date(),
        quiz_scoring_enabled: includeMediaQuizFlow,
        quiz_pass_threshold: includeMediaQuizFlow ? 100 : 80,
        quiz_max_attempts: includeMediaQuizFlow ? 2 : 3,
        quiz_cooldown_minutes: includeMediaQuizFlow ? 0 : 15,
        quiz_required_for_entry: includeMediaQuizFlow,
        induction_media: includeMediaQuizFlow
          ? {
              version: 1,
              requireAcknowledgement: true,
              acknowledgementLabel:
                "I have reviewed the induction material before continuing.",
              blocks: [
                {
                  id: "media-1",
                  type: "TEXT",
                  title: "Site Safety Briefing",
                  body: "Review this briefing before continuing to the quiz.",
                  sortOrder: 1,
                },
              ],
            }
          : undefined,
        induction_languages: includeLanguageVariants
          ? {
              version: 1,
              defaultLanguage: "en",
              variants: [
                {
                  languageCode: "mi",
                  label: "Te Reo Maori",
                  templateName: "Whakauru Pae",
                  templateDescription: "Whakaotia nga patai haumaru katoa.",
                  acknowledgementLabel:
                    "Kua panui ahau i nga rauemi whakangungu i mua i te haere tonu.",
                  questions: [],
                },
              ],
            }
          : undefined,
      },
    });

    // Add at least one required question so the flow can proceed.
    const question = await prisma.inductionQuestion.create({
      data: {
        template_id: template.id,
        question_text: includeMediaQuizFlow
          ? "Are you wearing the required PPE on site?"
          : "I agree to follow site rules",
        question_type: includeMediaQuizFlow
          ? QuestionType.YES_NO
          : QuestionType.ACKNOWLEDGMENT,
        is_required: true,
        display_order: 1,
        ...(includeMediaQuizFlow ? { correct_answer: "yes" } : {}),
      },
    });

    if (includeLanguageVariants) {
      await prisma.inductionTemplate.updateMany({
        where: { id: template.id },
        data: {
          induction_languages: {
            version: 1,
            defaultLanguage: "en",
            variants: [
              {
                languageCode: "mi",
                label: "Te Reo Maori",
                templateName: "Whakauru Pae",
                templateDescription: "Whakaotia nga patai haumaru katoa.",
                acknowledgementLabel:
                  "Kua panui ahau i nga rauemi whakangungu i mua i te haere tonu.",
                questions: [
                  {
                    questionId: question.id,
                    questionText: "E whakaae ana ahau ki nga ture o te pae",
                    optionLabels: null,
                  },
                ],
              },
            ],
          },
        },
      });
    }

    let redFlagQuestionId: string | undefined;
    if (includeRedFlagQuestion) {
      const redFlagQuestion = await prisma.inductionQuestion.create({
        data: {
          template_id: template.id,
          question_text: "Do you feel unsafe or unwell to work on site today?",
          question_type: QuestionType.YES_NO,
          is_required: true,
          red_flag: true,
          display_order: 2,
        },
      });
      redFlagQuestionId = redFlagQuestion.id;
    }

    // Attempt to clear in-memory rate-limit state for deterministic tests
    let clearedRateLimit = false;
    try {
      __test_clearInMemoryStore();
      clearedRateLimit = true;
    } catch (_err: unknown) {
      clearedRateLimit = false;
    }

    return NextResponse.json({
      success: true,
      slug,
      siteId: site.id,
      publicLinkId: publicLink.id,
      templateId: template.id,
      questionId: question.id,
      redFlagQuestionId,
      includeLanguageVariants,
      includeMediaQuizFlow,
      includeGeofenceOverrideFlow,
      geofenceOverrideCode: includeGeofenceOverrideFlow ? "123456" : undefined,
      clearedRateLimit,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? "");
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  const accessDenied = ensureTestRouteAccess(req);
  if (accessDenied) return accessDenied;

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    // Find public link
    const link = await prisma.sitePublicLink.findFirst({ where: { slug } });
    if (!link) {
      return NextResponse.json({ success: true, deleted: false });
    }

    // Remove template(s) and site resources
    // For safety, mark site and link inactive rather than hard delete
    await prisma.sitePublicLink.updateMany({
      where: { slug },
      data: { is_active: false },
    });
    await prisma.site.updateMany({
      where: { id: link.site_id },
      data: { is_active: false },
    });

    return NextResponse.json({ success: true, deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? "");
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
