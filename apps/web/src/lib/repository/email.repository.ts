/**
 * Email Notification Repository
 *
 * Queues outbound emails in EmailNotification for async worker delivery.
 */

import { scopedDb } from "@/lib/db/scoped-db";
import type { EmailNotification } from "@prisma/client";
import { handlePrismaError, RepositoryError, requireCompanyId } from "./base";

export interface QueueEmailNotificationInput {
  to: string;
  subject: string;
  body: string;
  user_id?: string;
}

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
