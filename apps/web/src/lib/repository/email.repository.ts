/**
 * Email Notification Repository
 *
 * Queues outbound emails in EmailNotification for async worker delivery.
 */

import { scopedDb } from "@/lib/db/scoped-db";
import { listPendingEmailNotificationsGlobal } from "@/lib/db/scoped";
import { enforceBudgetPath } from "@/lib/cost/budget-service";
import type { EmailNotification } from "@prisma/client";
import { handlePrismaError, RepositoryError, requireCompanyId } from "./base";

export interface QueueEmailNotificationInput {
  to: string;
  subject: string;
  body: string;
  user_id?: string;
}

export type PendingEmailNotification = Pick<
  EmailNotification,
  "id" | "company_id" | "to" | "subject" | "body" | "attempts"
>;

export async function queueEmailNotification(
  companyId: string,
  input: QueueEmailNotificationInput,
): Promise<EmailNotification> {
  requireCompanyId(companyId);

  const to = input.to.trim().toLowerCase();
  const subject = input.subject.trim();
  const body = input.body.trim();

  if (!to) {
    throw new RepositoryError("Recipient email is required", "VALIDATION");
  }
  if (!subject) {
    throw new RepositoryError("Email subject is required", "VALIDATION");
  }
  if (!body) {
    throw new RepositoryError("Email body is required", "VALIDATION");
  }

  try {
    const budgetDecision = await enforceBudgetPath("notifications.email.queue");
    if (!budgetDecision.allowed) {
      throw new RepositoryError(budgetDecision.message, "FORBIDDEN");
    }

    const db = scopedDb(companyId);
    return await db.emailNotification.create({
      data: {
        to,
        subject,
        body,
        user_id: input.user_id ?? null,
        status: "PENDING",
      },
    });
  } catch (error) {
    handlePrismaError(error, "EmailNotification");
  }
}

export async function listPendingEmailNotifications(
  limit: number = 50,
): Promise<PendingEmailNotification[]> {
  try {
    return await listPendingEmailNotificationsGlobal(limit);
  } catch (error) {
    handlePrismaError(error, "EmailNotification");
  }
}

export async function markEmailNotificationSent(
  companyId: string,
  notificationId: string,
  attempts: number,
): Promise<void> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const result = await db.emailNotification.updateMany({
      where: {
        id: notificationId,
        company_id: companyId,
      },
      data: {
        status: "SENT",
        sent_at: new Date(),
        attempts,
        last_tried: null,
        error: null,
      },
    });

    if (result.count === 0) {
      throw new RepositoryError("EmailNotification not found", "NOT_FOUND");
    }
  } catch (error) {
    handlePrismaError(error, "EmailNotification");
  }
}

export async function markEmailNotificationAttemptFailed(
  companyId: string,
  notificationId: string,
  attempts: number,
  errorMessage: string,
): Promise<void> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const result = await db.emailNotification.updateMany({
      where: {
        id: notificationId,
        company_id: companyId,
      },
      data: {
        attempts,
        last_tried: new Date(),
        error: errorMessage,
        status: attempts >= 3 ? "FAILED" : "PENDING",
      },
    });

    if (result.count === 0) {
      throw new RepositoryError("EmailNotification not found", "NOT_FOUND");
    }
  } catch (error) {
    handlePrismaError(error, "EmailNotification");
  }
}
