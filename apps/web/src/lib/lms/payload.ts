import type { SignInResult } from "@/lib/repository/public-signin.repository";
import type { Prisma } from "@prisma/client";

export type LmsProviderKey = "GENERIC" | "MOODLE" | "SCORM_CLOUD";

export interface LmsCompletionPayloadInput {
  provider: string | null;
  courseCode: string | null;
  siteId: string;
  result: SignInResult;
  occurredAt: Date;
}

function normalizeProvider(provider: string | null): LmsProviderKey {
  if (!provider) {
    return "GENERIC";
  }

  const normalized = provider.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "MOODLE") {
    return "MOODLE";
  }
  if (normalized === "SCORM_CLOUD") {
    return "SCORM_CLOUD";
  }
  return "GENERIC";
}

export function buildLmsCompletionPayload(input: LmsCompletionPayloadInput): {
  provider: LmsProviderKey;
  payload: Prisma.InputJsonValue;
} {
  const provider = normalizeProvider(input.provider);
  const occurredAtIso = input.occurredAt.toISOString();
  const commonData = {
    signInRecordId: input.result.signInRecordId,
    visitorName: input.result.visitorName,
    siteId: input.siteId,
    siteName: input.result.siteName,
    signInTime: input.result.signInTime.toISOString(),
    courseCode: input.courseCode,
  };

  if (provider === "MOODLE") {
    return {
      provider,
      payload: {
        event: "lms.completion",
        occurredAt: occurredAtIso,
        provider,
        moodleCompletion: {
          activityCode: input.courseCode,
          externalUserRef: input.result.signInRecordId,
          completedAt: input.result.signInTime.toISOString(),
          participant: input.result.visitorName,
          site: {
            id: input.siteId,
            name: input.result.siteName,
          },
        },
        data: commonData,
      } as Prisma.InputJsonValue,
    };
  }

  if (provider === "SCORM_CLOUD") {
    return {
      provider,
      payload: {
        event: "lms.completion",
        occurredAt: occurredAtIso,
        provider,
        scormCloud: {
          registrationId: input.result.signInRecordId,
          courseId: input.courseCode,
          learner: {
            id: input.result.signInRecordId,
            name: input.result.visitorName,
          },
          completedAt: input.result.signInTime.toISOString(),
          context: {
            siteId: input.siteId,
            siteName: input.result.siteName,
          },
        },
        data: commonData,
      } as Prisma.InputJsonValue,
    };
  }

  return {
    provider,
    payload: {
      event: "lms.completion",
      occurredAt: occurredAtIso,
      provider,
      courseCode: input.courseCode,
      data: commonData,
    } as Prisma.InputJsonValue,
  };
}
