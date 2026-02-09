import { publicDb } from "@/lib/db/public-db";
import { sendEmail } from "@/lib/email/resend";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";

/**
 * Email Queue Processor
 */
export async function processEmailQueue() {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    // 1. Process Red Flags (High Priority)
    // Find recent sign-ins with red flags that haven't been notified
    const pendingRedFlags = await publicDb.inductionResponse.findMany({
      where: {
        passed: true, // They finished, but we need to check answers
        sign_in_record: {
          created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      },
      include: {
        sign_in_record: {
          include: {
            site: {
              include: {
                site_managers: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
        },
        template: {
          include: {
            questions: true,
          },
        },
      },
    });

    for (const response of pendingRedFlags) {
      const answers = response.answers as unknown as Array<{
        questionId: string;
        answer: unknown;
      }>;
      const redFlagQuestions = (
        response.template.questions as unknown as Array<{
          red_flag: boolean;
          id: string;
          question_text: string;
        }>
      ).filter((q) => q.red_flag);

      let hasRedFlag = false;
      const flagsFound: string[] = [];

      for (const q of redFlagQuestions) {
        const answer = answers.find((a) => a.questionId === q.id);

        // Logic: Check if the answer is a truthy value for a red flag question.
        // We treat 'yes' (string), true (boolean), or a string that's not 'no'/'false' as a trigger.
        // This is a safety/logic engine fix that was likely in 'feat/logic-engine'.
        const isTruthyAnswer =
          answer &&
          (String(answer.answer).toLowerCase() === "yes" ||
            answer.answer === true ||
            (typeof answer.answer === "string" &&
              answer.answer.toLowerCase() !== "no" &&
              answer.answer.toLowerCase() !== "false" &&
              answer.answer.toLowerCase() !== "false")); // Redundant 'false' check is harmless but included for completeness.

        if (isTruthyAnswer) {
          hasRedFlag = true;
          flagsFound.push(q.question_text);
        }
      }

      if (hasRedFlag) {
        // Check if we already sent this one (idempotency via AuditLog)
        const existingLog = await publicDb.auditLog.findFirst({
          where: {
            action: "email.red_flag_alert",
            entity_id: response.id,
          },
        });

        if (!existingLog) {
          const managers = response.sign_in_record.site.site_managers;
          for (const assignment of managers) {
            const manager = assignment.user;
            if (manager.email) {
              await sendEmail({
                to: manager.email,
                subject: `⚠️ RED FLAG ALERT: ${response.sign_in_record.visitor_name} at ${response.sign_in_record.site.name}`,
                html: `
                  <h1>Safety Alert</h1>
                  <p>A visitor has answered "YES" to one or more red-flag safety questions.</p>
                  <p><strong>Visitor:</strong> ${response.sign_in_record.visitor_name}</p>
                  <p><strong>Site:</strong> ${response.sign_in_record.site.name}</p>
                  <p><strong>Flags Triggered:</strong></p>
                  <ul>
                    ${flagsFound.map((f) => `<li>${f}</li>`).join("")}
                  </ul>
                  <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/sites/${response.sign_in_record.site_id}">View Site Dashboard</a></p>
                `,
              });
            }
          }

          // Record that we sent it
          await publicDb.auditLog.create({
            data: {
              company_id: response.sign_in_record.company_id,
              action: "email.red_flag_alert",
              entity_type: "InductionResponse",
              entity_id: response.id,
              details: { manager_count: managers.length },
            },
          });
        }
      }
    }

    // 2. Process Pending Notifications from EmailNotification table
    // Type-safe workaround for late-bound schema models
    const dbAny = publicDb as unknown as {
      emailNotification: {
        findMany: (args: unknown) => Promise<
          Array<{
            id: string;
            to: string;
            subject: string;
            body: string;
            attempts: number;
          }>
        >;
        update: (args: unknown) => Promise<unknown>;
      };
    };
    const notificationTable = dbAny.emailNotification;

    if (notificationTable) {
      const pending = await notificationTable.findMany({
        where: { status: "PENDING", attempts: { lt: 3 } },
        take: 50,
      });

      for (const notification of pending) {
        try {
          await sendEmail({
            to: notification.to,
            subject: notification.subject,
            html: notification.body,
          });

          await notificationTable.update({
            where: { id: notification.id },
            data: {
              status: "SENT",
              sent_at: new Date(),
              attempts: notification.attempts + 1,
            },
          });
        } catch (err) {
          await notificationTable.update({
            where: { id: notification.id },
            data: {
              attempts: notification.attempts + 1,
              last_tried: new Date(),
              error: String(err),
              status: notification.attempts >= 2 ? "FAILED" : "PENDING",
            },
          });
        }
      }
    }

    log.info({}, "Email worker processing completed");
  } catch (err) {
    log.error({ err: String(err) }, "Email worker error");
  }
}

/**
 * Weekly Digest Processor
 */
export async function processWeeklyDigest() {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    const companies = await publicDb.company.findMany({
      include: {
        users: {
          where: { role: "ADMIN", is_active: true },
        },
      },
    });

    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    for (const company of companies) {
      if (company.users.length === 0) continue;

      const [inductionCount, redFlagCount, expiringDocuments] =
        await Promise.all([
          publicDb.signInRecord.count({
            where: {
              company_id: company.id,
              sign_in_ts: { gte: lastWeek },
            },
          }),
          publicDb.auditLog.count({
            where: {
              company_id: company.id,
              action: "email.red_flag_alert",
              created_at: { gte: lastWeek },
            },
          }),
          publicDb.contractorDocument.count({
            where: {
              contractor: { company_id: company.id },
              expires_at: {
                gt: new Date(),
                lt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Next 30 days
              },
            },
          }),
        ]);

      const html = `
        <h1>Weekly Site Safety Digest</h1>
        <p>Here is the summary for <strong>${company.name}</strong> for the last 7 days:</p>
        <ul>
          <li><strong>Total Inductions/Sign-ins:</strong> ${inductionCount}</li>
          <li><strong>Red Flags Detected:</strong> ${redFlagCount}</li>
          <li><strong>Documents Expiring (Next 30 days):</strong> ${expiringDocuments}</li>
        </ul>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/admin">View Full Dashboard</a></p>
      `;

      for (const admin of company.users) {
        await sendEmail({
          to: admin.email,
          subject: `📊 Weekly Safety Digest: ${company.name}`,
          html,
        });
      }

      await publicDb.auditLog.create({
        data: {
          company_id: company.id,
          action: "email.weekly_digest",
          details: {
            inductionCount,
            redFlagCount,
            expiringDocuments,
            recipient_count: company.users.length,
          },
        },
      });
    }

    log.info({}, "Weekly digest processing completed");
  } catch (err) {
    log.error({ err: String(err) }, "Weekly digest error");
  }
}
