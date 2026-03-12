import { publicDb } from "@/lib/db/public-db";
import { sendEmail } from "@/lib/email/resend";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import { decryptJsonValue } from "@/lib/security/data-protection";
import { queueEmailNotification } from "@/lib/repository/email.repository";
import {
  assertCompanyFeatureEnabled,
  EntitlementDeniedError,
  type ProductFeatureKey,
} from "@/lib/plans";

const INVITE_REMINDER_WINDOW_HOURS = 24;
const INVITE_REMINDER_BATCH_LIMIT = 100;
const INVITE_REMINDER_PREVIEW_LIMIT = 25;
const COMPANY_BATCH_SIZE = 50;
const DOCUMENT_REMINDER_WINDOWS_DAYS = [1, 7, 14, 30] as const;
const DOCUMENT_REMINDER_BATCH_LIMIT = 300;
const DOCUMENT_REMINDER_PREVIEW_LIMIT = 30;
const EMAIL_TABLE_BORDER_COLOR = "#d4d7e6";
const EMAIL_TABLE_HEADER_BG = "#f8f2e8";
const EMAIL_TEXT_PRIMARY = "#171924";
const EMAIL_TEXT_MUTED = "#50576d";
const EMAIL_TABLE_STYLE = `border-collapse:collapse;font-size:13px;color:${EMAIL_TEXT_PRIMARY};`;
const EMAIL_TABLE_CELL_STYLE = `padding:6px 8px;border:1px solid ${EMAIL_TABLE_BORDER_COLOR};`;
const EMAIL_TABLE_HEADER_CELL_STYLE = `${EMAIL_TABLE_CELL_STYLE}text-align:left;background:${EMAIL_TABLE_HEADER_BG};`;
const EMAIL_NOTICE_STYLE = `margin-top:12px;color:${EMAIL_TEXT_MUTED};`;
type DocumentReminderWindowDays = (typeof DOCUMENT_REMINDER_WINDOWS_DAYS)[number];
type ContractorDocumentReminderCandidate = {
  key: string;
  documentId: string;
  contractorName: string;
  documentType: string;
  expiresAt: Date;
  windowDays: DocumentReminderWindowDays;
};

async function isCompanyFeatureEnabled(input: {
  companyId: string;
  featureKey: ProductFeatureKey;
  requestId: string;
  log: ReturnType<typeof createRequestLogger>;
}): Promise<boolean> {
  try {
    await assertCompanyFeatureEnabled(input.companyId, input.featureKey);
    return true;
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      input.log.info(
        {
          requestId: input.requestId,
          companyId: input.companyId,
          featureKey: input.featureKey,
        },
        "Skipped email worker feature path due to entitlement denial",
      );
      return false;
    }

    input.log.error(
      {
        requestId: input.requestId,
        companyId: input.companyId,
        featureKey: input.featureKey,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to evaluate feature entitlement in email worker",
    );
    return false;
  }
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildPreRegistrationReminderHtml(input: {
  companyName: string;
  windowHours: number;
  invites: Array<{
    siteName: string;
    visitorName: string;
    visitorType: string;
    expiresAt: Date;
  }>;
  totalInvites: number;
}): string {
  const previewRows = input.invites
    .slice(0, INVITE_REMINDER_PREVIEW_LIMIT)
    .map(
      (invite) => `
      <tr>
        <td style="${EMAIL_TABLE_CELL_STYLE}">${escapeHtml(invite.siteName)}</td>
        <td style="${EMAIL_TABLE_CELL_STYLE}">${escapeHtml(invite.visitorName)}</td>
        <td style="${EMAIL_TABLE_CELL_STYLE}">${escapeHtml(invite.visitorType)}</td>
        <td style="${EMAIL_TABLE_CELL_STYLE}">${escapeHtml(invite.expiresAt.toISOString())}</td>
      </tr>`,
    )
    .join("");

  const hiddenCount = Math.max(input.totalInvites - INVITE_REMINDER_PREVIEW_LIMIT, 0);
  const hiddenNotice =
    hiddenCount > 0
      ? `<p style="${EMAIL_NOTICE_STYLE}">${hiddenCount} additional invite(s) are omitted from this preview.</p>`
      : "";

  return `
    <h1>Pre-Registration Invites Expiring Soon</h1>
    <p><strong>${escapeHtml(input.companyName)}</strong> has ${input.totalInvites} unused pre-registration invite(s) expiring within the next ${input.windowHours} hours.</p>
    <table style="${EMAIL_TABLE_STYLE}">
      <thead>
        <tr>
          <th style="${EMAIL_TABLE_HEADER_CELL_STYLE}">Site</th>
          <th style="${EMAIL_TABLE_HEADER_CELL_STYLE}">Visitor</th>
          <th style="${EMAIL_TABLE_HEADER_CELL_STYLE}">Type</th>
          <th style="${EMAIL_TABLE_HEADER_CELL_STYLE}">Expires (UTC)</th>
        </tr>
      </thead>
      <tbody>${previewRows}</tbody>
    </table>
    ${hiddenNotice}
  `;
}

async function queuePreRegistrationInviteReminderBatches(input: {
  now: Date;
  requestId: string;
  log: ReturnType<typeof createRequestLogger>;
}) {
  const reminderWindowEnd = new Date(
    input.now.getTime() + INVITE_REMINDER_WINDOW_HOURS * 60 * 60 * 1000,
  );
  const reminderBatchId = `invite-reminders-${input.now.toISOString().slice(0, 10)}`;

  let companyCursor: string | undefined;
  while (true) {
    const companies = await publicDb.company.findMany({
      take: COMPANY_BATCH_SIZE,
      ...(companyCursor ? { skip: 1, cursor: { id: companyCursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        users: {
          where: {
            is_active: true,
            role: { in: ["ADMIN", "SITE_MANAGER"] },
          },
          select: {
            id: true,
            email: true,
          },
          orderBy: [{ role: "asc" }, { created_at: "asc" }],
        },
      },
    });

    if (companies.length === 0) {
      break;
    }

    for (const company of companies) {
      const preregFeatureEnabled = await isCompanyFeatureEnabled({
        companyId: company.id,
        featureKey: "PREREG_INVITES",
        requestId: input.requestId,
        log: input.log,
      });
      if (!preregFeatureEnabled) {
        continue;
      }

      const alreadySent = await publicDb.auditLog.findFirst({
        where: {
          company_id: company.id,
          action: "preregistration.reminder_batch",
          entity_type: "PreRegistrationReminderBatch",
          entity_id: reminderBatchId,
        },
        select: { id: true },
      });
      if (alreadySent) {
        continue;
      }

      const invites = await publicDb.preRegistrationInvite.findMany({
        where: {
          company_id: company.id,
          is_active: true,
          used_at: null,
          expires_at: {
            gte: input.now,
            lte: reminderWindowEnd,
          },
        },
        orderBy: [{ expires_at: "asc" }, { created_at: "asc" }],
        take: INVITE_REMINDER_BATCH_LIMIT,
        select: {
          site: { select: { name: true } },
          visitor_name: true,
          visitor_type: true,
          expires_at: true,
        },
      });

      if (invites.length === 0) {
        continue;
      }

      const recipients = company.users;
      if (recipients.length === 0) {
        input.log.warn(
          {
            requestId: input.requestId,
            companyId: company.id,
            inviteCount: invites.length,
          },
          "Skipped invite reminders because no active admin/site-manager recipients were found",
        );
        continue;
      }

      const html = buildPreRegistrationReminderHtml({
        companyName: company.name,
        windowHours: INVITE_REMINDER_WINDOW_HOURS,
        invites: invites.map((invite) => ({
          siteName: invite.site.name,
          visitorName: invite.visitor_name,
          visitorType: invite.visitor_type,
          expiresAt: invite.expires_at,
        })),
        totalInvites: invites.length,
      });

      const queueResults = await Promise.allSettled(
        recipients.map((recipient) =>
          queueEmailNotification(company.id, {
            user_id: recipient.id,
            to: recipient.email,
            subject: `Reminder: ${invites.length} pre-registration invite(s) expiring soon`,
            body: html,
          }),
        ),
      );

      const queuedCount = queueResults.filter(
        (result) => result.status === "fulfilled",
      ).length;

      await publicDb.auditLog.create({
        data: {
          company_id: company.id,
          action: "preregistration.reminder_batch",
          entity_type: "PreRegistrationReminderBatch",
          entity_id: reminderBatchId,
          details: {
            window_hours: INVITE_REMINDER_WINDOW_HOURS,
            invite_count: invites.length,
            recipients: recipients.length,
            queued: queuedCount,
          },
          request_id: input.requestId,
        },
      });
    }

    companyCursor = companies[companies.length - 1]?.id;
  }
}

function resolveDocumentReminderWindowDays(
  expiresAt: Date,
  now: Date,
): DocumentReminderWindowDays | null {
  const millisUntilExpiry = expiresAt.getTime() - now.getTime();
  if (millisUntilExpiry < 0) {
    return null;
  }

  const daysUntilExpiry = Math.ceil(millisUntilExpiry / (24 * 60 * 60 * 1000));
  if (daysUntilExpiry <= 1) return 1;
  if (daysUntilExpiry <= 7) return 7;
  if (daysUntilExpiry <= 14) return 14;
  if (daysUntilExpiry <= 30) return 30;
  return null;
}

function buildContractorDocumentReminderHtml(input: {
  companyName: string;
  reminders: Array<{
    contractorName: string;
    documentType: string;
    expiresAt: Date;
    windowDays: number;
  }>;
}): string {
  const rows = input.reminders
    .slice(0, DOCUMENT_REMINDER_PREVIEW_LIMIT)
    .map(
      (reminder) => `
      <tr>
        <td style="${EMAIL_TABLE_CELL_STYLE}">${escapeHtml(reminder.contractorName)}</td>
        <td style="${EMAIL_TABLE_CELL_STYLE}">${escapeHtml(reminder.documentType)}</td>
        <td style="${EMAIL_TABLE_CELL_STYLE}">${escapeHtml(reminder.expiresAt.toISOString())}</td>
        <td style="${EMAIL_TABLE_CELL_STYLE}">${reminder.windowDays} day</td>
      </tr>`,
    )
    .join("");

  const hiddenCount = Math.max(
    input.reminders.length - DOCUMENT_REMINDER_PREVIEW_LIMIT,
    0,
  );
  const hiddenNotice =
    hiddenCount > 0
      ? `<p style="${EMAIL_NOTICE_STYLE}">${hiddenCount} additional reminder(s) are omitted from this preview.</p>`
      : "";

  return `
    <h1>Contractor Document Expiry Reminders</h1>
    <p><strong>${escapeHtml(input.companyName)}</strong> has ${input.reminders.length} contractor document reminder(s) due for dispatch.</p>
    <table style="${EMAIL_TABLE_STYLE}">
      <thead>
        <tr>
          <th style="${EMAIL_TABLE_HEADER_CELL_STYLE}">Contractor</th>
          <th style="${EMAIL_TABLE_HEADER_CELL_STYLE}">Document</th>
          <th style="${EMAIL_TABLE_HEADER_CELL_STYLE}">Expires (UTC)</th>
          <th style="${EMAIL_TABLE_HEADER_CELL_STYLE}">Window</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${hiddenNotice}
  `;
}

async function queueContractorDocumentExpiryReminders(input: {
  now: Date;
  requestId: string;
  log: ReturnType<typeof createRequestLogger>;
}) {
  const reminderWindowEnd = new Date(
    input.now.getTime() + 30 * 24 * 60 * 60 * 1000,
  );

  let companyCursor: string | undefined;
  while (true) {
    const companies = await publicDb.company.findMany({
      take: COMPANY_BATCH_SIZE,
      ...(companyCursor ? { skip: 1, cursor: { id: companyCursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        users: {
          where: {
            is_active: true,
            role: { in: ["ADMIN", "SITE_MANAGER"] },
          },
          select: {
            id: true,
            email: true,
          },
          orderBy: [{ role: "asc" }, { created_at: "asc" }],
        },
      },
    });

    if (companies.length === 0) {
      break;
    }

    for (const company of companies) {
      const remindersFeatureEnabled = await isCompanyFeatureEnabled({
        companyId: company.id,
        featureKey: "REMINDERS_ENHANCED",
        requestId: input.requestId,
        log: input.log,
      });
      if (!remindersFeatureEnabled) {
        continue;
      }

      const documents = await publicDb.contractorDocument.findMany({
        where: {
          contractor: { company_id: company.id },
          expires_at: {
            gte: input.now,
            lte: reminderWindowEnd,
          },
        },
        orderBy: [{ expires_at: "asc" }, { uploaded_at: "asc" }],
        take: DOCUMENT_REMINDER_BATCH_LIMIT,
        select: {
          id: true,
          contractor_id: true,
          document_type: true,
          expires_at: true,
        },
      });

      if (documents.length === 0) {
        continue;
      }

      const contractorIds = [...new Set(documents.map((document) => document.contractor_id))];
      const contractors = await publicDb.contractor.findMany({
        where: {
          company_id: company.id,
          id: { in: contractorIds },
        },
        select: {
          id: true,
          name: true,
        },
      });
      const contractorNameById = new Map(
        contractors.map((contractor) => [contractor.id, contractor.name]),
      );

      const reminderCandidates: ContractorDocumentReminderCandidate[] = [];
      for (const document of documents) {
        if (!document.expires_at) {
          continue;
        }

        const windowDays = resolveDocumentReminderWindowDays(
          document.expires_at,
          input.now,
        );
        if (!windowDays) {
          continue;
        }

        reminderCandidates.push({
          key: `${document.id}:w${windowDays}`,
          documentId: document.id,
          contractorName:
            contractorNameById.get(document.contractor_id) ?? "Unknown Contractor",
          documentType: String(document.document_type),
          expiresAt: document.expires_at,
          windowDays,
        });
      }

      if (reminderCandidates.length === 0) {
        continue;
      }

      const existingReminderAuditLogs = await publicDb.auditLog.findMany({
        where: {
          company_id: company.id,
          action: "contractor.document_expiry_reminder",
          entity_id: { in: reminderCandidates.map((candidate) => candidate.key) },
        },
        select: { entity_id: true },
      });
      const sentReminderKeys = new Set(
        existingReminderAuditLogs
          .map((row) => row.entity_id)
          .filter((row): row is string => Boolean(row)),
      );

      const unsentReminders = reminderCandidates.filter(
        (candidate) => !sentReminderKeys.has(candidate.key),
      );
      if (unsentReminders.length === 0) {
        continue;
      }

      const recipients = company.users;
      if (recipients.length === 0) {
        input.log.warn(
          {
            requestId: input.requestId,
            companyId: company.id,
            unsentReminderCount: unsentReminders.length,
          },
          "Skipped contractor-document reminders because no active admin/site-manager recipients were found",
        );
        continue;
      }

      const html = buildContractorDocumentReminderHtml({
        companyName: company.name,
        reminders: unsentReminders.map((reminder) => ({
          contractorName: reminder.contractorName,
          documentType: reminder.documentType,
          expiresAt: reminder.expiresAt,
          windowDays: reminder.windowDays,
        })),
      });

      const queueResults = await Promise.allSettled(
        recipients.map((recipient) =>
          queueEmailNotification(company.id, {
            user_id: recipient.id,
            to: recipient.email,
            subject: `Reminder: ${unsentReminders.length} contractor document(s) nearing expiry`,
            body: html,
          }),
        ),
      );
      const queuedCount = queueResults.filter(
        (result) => result.status === "fulfilled",
      ).length;

      if (queuedCount === 0) {
        continue;
      }

      await publicDb.auditLog.createMany({
        data: unsentReminders.map((reminder) => ({
          company_id: company.id,
          action: "contractor.document_expiry_reminder",
          entity_type: "ContractorDocumentReminder",
          entity_id: reminder.key,
          details: {
            document_id: reminder.documentId,
            contractor_name: reminder.contractorName,
            document_type: reminder.documentType,
            window_days: reminder.windowDays,
            expires_at: reminder.expiresAt.toISOString(),
          },
          request_id: input.requestId,
        })),
      });

      await publicDb.auditLog.create({
        data: {
          company_id: company.id,
          action: "contractor.document_expiry_reminder_batch",
          entity_type: "ContractorDocumentReminderBatch",
          entity_id: `${input.now.toISOString().slice(0, 10)}`,
          details: {
            reminders: unsentReminders.length,
            recipients: recipients.length,
            queued: queuedCount,
            windows: DOCUMENT_REMINDER_WINDOWS_DAYS,
          },
          request_id: input.requestId,
        },
      });
    }

    companyCursor = companies[companies.length - 1]?.id;
  }
}

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
        const answers = decryptJsonValue<
          Array<{
            questionId: string;
            answer: unknown;
          }>
        >(response.answers);
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

    // 2. Queue daily pre-registration invite reminder batches
    await queuePreRegistrationInviteReminderBatches({
      now: new Date(),
      requestId,
      log,
    });

    // 3. Queue contractor document expiry reminders with window dedupe
    await queueContractorDocumentExpiryReminders({
      now: new Date(),
      requestId,
      log,
    });

    // 4. Process Pending Notifications from EmailNotification table
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

