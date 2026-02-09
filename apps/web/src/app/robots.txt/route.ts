import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "https://inductlite.com"
  ).replace(/\/$/, "");

  const content = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /_next/

Sitemap: ${baseUrl}/sitemap.xml
`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
