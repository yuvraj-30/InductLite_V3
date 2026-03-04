/**
 * Demo Booking Repository
 *
 * Persists public demo-booking requests and notification delivery state.
 * These records are intentionally non-tenant global leads.
 */

import { publicDb } from "@/lib/db/public-db";
import type {
  DemoBookingNotificationStatus,
  DemoBookingRequest,
  Prisma,
} from "@prisma/client";
import { handlePrismaError, RepositoryError } from "./base";

export interface CreateDemoBookingRequestInput {
  fullName: string;
  workEmail: string;
  companyName: string;
  phone?: string | null;
  siteCount?: number | null;
  targetGoLiveDate?: Date | null;
  requirements: string;
  sourcePath?: string;
  ipHash?: string | null;
  userAgent?: string | null;
}

export interface UpdateDemoBookingNotificationInput {
  status: DemoBookingNotificationStatus;
  recipients: string[];
  attemptedAt: Date;
  sentAt?: Date | null;
  errorMessage?: string | null;
}

function normalizeText(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new RepositoryError("Field cannot be empty", "VALIDATION");
  }
  return normalized;
}

export async function createDemoBookingRequest(
  input: CreateDemoBookingRequestInput,
): Promise<DemoBookingRequest> {
  const fullName = normalizeText(input.fullName);
  const workEmail = normalizeText(input.workEmail).toLowerCase();
  const companyName = normalizeText(input.companyName);
  const requirements = normalizeText(input.requirements);

  const sourcePath = input.sourcePath?.trim() || "/demo";
  const phone = input.phone?.trim() || null;
  const ipHash = input.ipHash?.trim() || null;
  const userAgent = input.userAgent?.trim() || null;

  if (input.siteCount !== undefined && input.siteCount !== null) {
    if (!Number.isInteger(input.siteCount) || input.siteCount <= 0) {
      throw new RepositoryError("siteCount must be a positive integer", "VALIDATION");
    }
  }

  try {
    return await publicDb.demoBookingRequest.create({
      data: {
        full_name: fullName,
        work_email: workEmail,
        company_name: companyName,
        phone,
        site_count: input.siteCount ?? null,
        target_go_live_date: input.targetGoLiveDate ?? null,
        requirements,
        source_path: sourcePath,
        ip_hash: ipHash,
        user_agent: userAgent,
      },
    });
  } catch (error) {
    handlePrismaError(error, "DemoBookingRequest");
  }
}

export async function updateDemoBookingNotificationStatus(
  requestId: string,
  input: UpdateDemoBookingNotificationInput,
): Promise<void> {
  if (!requestId?.trim()) {
    throw new RepositoryError("requestId is required", "VALIDATION");
  }

  const recipients = input.recipients.filter((value) => value.trim().length > 0);
  const recipientsJson = recipients as unknown as Prisma.InputJsonValue;

  try {
    await publicDb.demoBookingRequest.update({
      where: { id: requestId },
      data: {
        notification_status: input.status,
        notification_recipients: recipientsJson,
        notification_attempted_at: input.attemptedAt,
        notification_sent_at: input.sentAt ?? null,
        notification_error_message: input.errorMessage?.trim() || null,
      },
    });
  } catch (error) {
    handlePrismaError(error, "DemoBookingRequest");
  }
}
