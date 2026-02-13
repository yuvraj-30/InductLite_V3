import { NextResponse } from "next/server";
import { PrismaClient, QuestionType } from "@prisma/client";
import { __test_clearInMemoryStore } from "@/lib/rate-limit";

const prisma = new PrismaClient();

// Only allow in test or when ALLOW_TEST_RUNNER is explicitly enabled
function allowed() {
  return (
    process.env.NODE_ENV === "test" || process.env.ALLOW_TEST_RUNNER === "1"
  );
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'NotFound' }, { status: 404 });
  }

  if (!allowed()) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const slugPrefix = (body.slugPrefix as string) ?? "test-site-e2e";
    // Use a random suffix to avoid collisions when running tests in parallel locally
    const suffix = Math.random().toString(36).slice(2, 8);
    const slug = `${slugPrefix}-${suffix}`;

    // Find or create a company to own the site (match seed company if present)
    const company =
      (await prisma.company.findFirst({ where: { slug: "buildright-nz" } })) ||
      (await prisma.company.create({
        data: {
          name: "E2E Company",
          slug: `e2e-${suffix}`,
          retention_days: 365,
        },
      }));

    // Create site
    const site = await prisma.site.create({
      data: {
        company_id: company.id,
        name: `E2E Site ${suffix}`,
        address: "",
        description: "Temporary E2E site",
        is_active: true,
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
      },
    });

    // Add a required acknowledgment question so the flow can proceed
    const question = await prisma.inductionQuestion.create({
      data: {
        template_id: template.id,
        question_text: "I agree to follow site rules",
        question_type: QuestionType.ACKNOWLEDGMENT,
        is_required: true,
        display_order: 1,
      },
    });

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
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'NotFound' }, { status: 404 });
  }

  if (!allowed()) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

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
