import { NextResponse } from "next/server";
import { publicDb } from "@/lib/db/public-db";
import { requireCronSecret } from "@/lib/cron";
import { sendEmail } from "@/lib/email/resend";

/**
 * Weekly Admin Digest
 * Triggers every Monday at 8:00 AM (configured in GH Actions)
 */
export async function GET(req: Request) {
  const cron = await requireCronSecret(req, "/api/cron/digest");
  if (!cron.ok) return cron.response;

  const { log } = cron;
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    // 1. Fetch stats
    const [inductionCount, redFlagCount, expiringLicenses] = await Promise.all([
      publicDb.inductionResponse.count({
        where: { completed_at: { gte: lastWeek } },
      }),
      publicDb.auditLog.count({
        where: {
          action: "email.red_flag_alert",
          created_at: { gte: lastWeek },
        },
      }),
      publicDb.contractorDocument.count({
        where: {
          expires_at: {
            gt: new Date(),
            lt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Next 14 days
          },
        },
      }),
    ]);

    // 2. Find all company admins
    const admins = await publicDb.user.findMany({
      where: { role: "ADMIN", is_active: true },
      select: { email: true, name: true },
    });

    // 3. Send digests
    for (const admin of admins) {
      if (!admin.email) continue;

      await sendEmail({
        to: admin.email,
        subject: "📊 InductLite Weekly Digest",
        html: `
          <h1>Weekly Safety Summary</h1>
          <p>Hello ${admin.name},</p>
          <p>Here is your summary for the last 7 days:</p>
          <ul>
            <li><strong>Total Inductions:</strong> ${inductionCount}</li>
            <li><strong>Red Flags Detected:</strong> ${redFlagCount}</li>
            <li><strong>Licenses Expiring Soon (14 days):</strong> ${expiringLicenses}</li>
          </ul>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/admin">View Full Dashboard</a></p>
        `,
      });
    }

    log.info({ admin_count: admins.length }, "Weekly digest sent");
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({ err: String(err) }, "Weekly digest failed");
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
