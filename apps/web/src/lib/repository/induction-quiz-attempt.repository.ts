import { scopedDb } from "@/lib/db/scoped-db";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import {
  handlePrismaError,
  RepositoryError,
  requireCompanyId,
} from "./base";

export interface InductionQuizAttemptState {
  id: string;
  company_id: string;
  site_id: string;
  template_id: string;
  visitor_phone_hash: string;
  failed_attempts: number;
  cooldown_until: Date | null;
  last_attempt_at: Date | null;
  last_score_percent: number | null;
  last_passed: boolean | null;
  created_at: Date;
  updated_at: Date;
}

function hashVisitorPhone(phoneE164: string): string {
  return createHash("sha256").update(phoneE164.trim()).digest("hex");
}

export async function findInductionQuizAttemptState(
  companyId: string,
  input: {
    siteId: string;
    templateId: string;
    visitorPhoneE164: string;
  },
): Promise<InductionQuizAttemptState | null> {
  requireCompanyId(companyId);

  const phoneHash = hashVisitorPhone(input.visitorPhoneE164);

  try {
    const db = scopedDb(companyId);
    const attempt = await db.inductionQuizAttempt.findFirst({
      where: {
        site_id: input.siteId,
        template_id: input.templateId,
        visitor_phone_hash: phoneHash,
      },
    });

    return attempt as InductionQuizAttemptState | null;
  } catch (error) {
    handlePrismaError(error, "InductionQuizAttempt");
  }
}

export async function upsertInductionQuizAttemptState(
  companyId: string,
  input: {
    siteId: string;
    templateId: string;
    visitorPhoneE164: string;
    failedAttempts: number;
    cooldownUntil: Date | null;
    lastAttemptAt: Date;
    lastScorePercent: number;
    lastPassed: boolean;
  },
): Promise<InductionQuizAttemptState> {
  requireCompanyId(companyId);

  const phoneHash = hashVisitorPhone(input.visitorPhoneE164);
  const db = scopedDb(companyId);

  const where = {
    site_id: input.siteId,
    template_id: input.templateId,
    visitor_phone_hash: phoneHash,
  };

  const data = {
    failed_attempts: input.failedAttempts,
    cooldown_until: input.cooldownUntil,
    last_attempt_at: input.lastAttemptAt,
    last_score_percent: input.lastScorePercent,
    last_passed: input.lastPassed,
  };

  try {
    const updateResult = await db.inductionQuizAttempt.updateMany({
      where,
      data,
    });

    if (updateResult.count > 0) {
      const updated = await db.inductionQuizAttempt.findFirst({ where });
      if (updated) {
        return updated as InductionQuizAttemptState;
      }
    }

    try {
      const created = await db.inductionQuizAttempt.create({
        data: {
          site_id: input.siteId,
          template_id: input.templateId,
          visitor_phone_hash: phoneHash,
          failed_attempts: input.failedAttempts,
          cooldown_until: input.cooldownUntil,
          last_attempt_at: input.lastAttemptAt,
          last_score_percent: input.lastScorePercent,
          last_passed: input.lastPassed,
        },
      });
      return created as InductionQuizAttemptState;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        // Concurrent writer won the create race. Retry with update + read.
        await db.inductionQuizAttempt.updateMany({ where, data });
        const updated = await db.inductionQuizAttempt.findFirst({ where });
        if (updated) {
          return updated as InductionQuizAttemptState;
        }
      }
      throw error;
    }
  } catch (error) {
    handlePrismaError(error, "InductionQuizAttempt");
  }

  throw new RepositoryError(
    "Failed to persist quiz attempt state",
    "DATABASE_ERROR",
  );
}
