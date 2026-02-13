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
    // Process recent responses in chunks to keep memory bounded.
    const redFlagBatchSize = 100;
    const redFlagWindowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let redFlagCursor: string | undefined;

    while (true) {
      const pendingRedFlags = await publicDb.inductionResponse.findMany({
        where: {
          passed: true, // They finished, but we need to check answers
          sign_in_record: {
            created_at: { gte: redFlagWindowStart },
          },
        },
        select: {
          id: true,
          answers: true,
          sign_in_record: {
            select: {
              company_id: true,
              site_id: true,
              visitor_name: true,
              site: {
                select: {
                  name: true,
                  site_managers: {
                    select: {
                      user: {
                        select: { email: true },
                      },
                    },
                  },
                },
              },
            },
          },
          template: {
            select: {
              questions: true,
            },
          },
        },
        orderBy: { id: "asc" },
        take: redFlagBatchSize,
        ...(redFlagCursor ? { skip: 1, cursor: { id: redFlagCursor } } : {}),
      });

      if (pendingRedFlags.length === 0) break;

      const existingAlerts = await publicDb.auditLog.findMany({
        where: {
          action: "email.red_flag_alert",
          entity_id: { in: pendingRedFlags.map((response) => response.id) },
        },
        select: { entity_id: true },
      });
      const alertedResponseIds = new Set(
        existingAlerts
          .map((logRow) => logRow.entity_id)
          .filter((id): id is string => Boolean(id)),
      );

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
          const isTruthyAnswer =
            answer &&
            (String(answer.answer).toLowerCase() === "yes" ||
              answer.answer === true ||
              (typeof answer.answer === "string" &&
                answer.answer.toLowerCase() !== "no" &&
                answer.answer.toLowerCase() !== "false"));

          if (isTruthyAnswer) {
            hasRedFlag = true;
            flagsFound.push(q.question_text);
          }
        }

        if (!hasRedFlag || alertedResponseIds.has(response.id)) {
          continue;
        }

        const managers = response.sign_in_record.site.site_managers;
        for (const assignment of managers) {
          const manager = assignment.user;
          if (manager.email) {
            await sendEmail({
              to: manager.email,
              subject: `RED FLAG ALERT: ${response.sign_in_record.visitor_name} at ${response.sign_in_record.site.name}`,
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
        alertedResponseIds.add(response.id);
      }

      redFlagCursor = pendingRedFlags[pendingRedFlags.length - 1]?.id;
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
    const batchSize = 50;
    let cursor: string | undefined;
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    while (true) {
      const companies = await publicDb.company.findMany({
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
        select: {
          id: true,
          name: true,
          users: {
            where: { role: "ADMIN", is_active: true },
            select: { email: true },
          },
        },
      });

      if (companies.length === 0) break;

      const companyIds = companies.map((company) => company.id);

      const [inductionCounts, redFlagCounts, expiringDocuments] =
        await Promise.all([
          publicDb.signInRecord.groupBy({
            by: ["company_id"],
            where: {
              company_id: { in: companyIds },
              sign_in_ts: { gte: lastWeek },
            },
            _count: { id: true },
          }),
          publicDb.auditLog.groupBy({
            by: ["company_id"],
            where: {
              company_id: { in: companyIds },
              action: "email.red_flag_alert",
              created_at: { gte: lastWeek },
            },
            _count: { id: true },
          }),
          publicDb.contractorDocument.findMany({
            where: {
              contractor: { company_id: { in: companyIds } },
              expires_at: {
                gt: now,
                lt: thirtyDaysFromNow,
              },
            },
            select: {
              contractor: {
                select: { company_id: true },
              },
            },
          }),
        ]);

      const inductionCountByCompany = new Map<string, number>(
        inductionCounts.map((row) => [row.company_id, row._count.id]),
      );
      const redFlagCountByCompany = new Map<string, number>(
        redFlagCounts.map((row) => [row.company_id, row._count.id]),
      );
      const expiringDocumentCountByCompany = new Map<string, number>();
      for (const row of expiringDocuments) {
        const key = row.contractor.company_id;
        expiringDocumentCountByCompany.set(
          key,
          (expiringDocumentCountByCompany.get(key) ?? 0) + 1,
        );
      }

      for (const company of companies) {
        if (company.users.length === 0) continue;
        const inductionCount = inductionCountByCompany.get(company.id) ?? 0;
        const redFlagCount = redFlagCountByCompany.get(company.id) ?? 0;
        const expiringDocumentsCount =
          expiringDocumentCountByCompany.get(company.id) ?? 0;

        const html = `
          <h1>Weekly Site Safety Digest</h1>
          <p>Here is the summary for <strong>${company.name}</strong> for the last 7 days:</p>
          <ul>
            <li><strong>Total Inductions/Sign-ins:</strong> ${inductionCount}</li>
            <li><strong>Red Flags Detected:</strong> ${redFlagCount}</li>
            <li><strong>Documents Expiring (Next 30 days):</strong> ${expiringDocumentsCount}</li>
          </ul>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/admin">View Full Dashboard</a></p>
        `;

        for (const admin of company.users) {
          await sendEmail({
            to: admin.email,
            subject: `Weekly Safety Digest: ${company.name}`,
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
              expiringDocuments: expiringDocumentsCount,
              recipient_count: company.users.length,
            },
          },
        });
      }

      cursor = companies[companies.length - 1]?.id;
    }

    log.info({}, "Weekly digest processing completed");
  } catch (err) {
    log.error({ err: String(err) }, "Weekly digest error");
    throw err;
  }
}
