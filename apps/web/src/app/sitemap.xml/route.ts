import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "https://inductlite.com"
  ).replace(/\/$/, "");

  try {
    const siteLinks = await prisma.sitePublicLink.findMany({
      where: { is_active: true },
      select: { slug: true, created_at: true },
      take: 5000,
    });

    const siteUrls = siteLinks
      .map(
        (link) => `
  <url>
    <loc>${baseUrl}/s/${link.slug}</loc>
    <lastmod>${link.created_at.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`,
      )
      .join("");

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>1.0</priority>
  </url>${siteUrls}
</urlset>
`;

    return new NextResponse(sitemap, {
      headers: {
        "Content-Type": "application/xml",
      },
    });
  } catch (error) {
    console.error("Sitemap generation error:", error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`,
      {
        headers: {
          "Content-Type": "application/xml",
        },
      },
    );
  }
}
