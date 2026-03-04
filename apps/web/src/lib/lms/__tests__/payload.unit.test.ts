import { describe, expect, it } from "vitest";
import { buildLmsCompletionPayload } from "../payload";

const baseInput = {
  provider: null as string | null,
  courseCode: "INDUCT-101",
  siteId: "site-1",
  occurredAt: new Date("2026-03-03T12:00:00.000Z"),
  result: {
    signInRecordId: "signin-1",
    signOutToken: "token-1",
    signOutTokenExpiresAt: new Date("2026-03-03T13:00:00.000Z"),
    visitorName: "Visitor One",
    siteName: "Alpha Site",
    signInTime: new Date("2026-03-03T11:59:00.000Z"),
  },
};

describe("lms payload mapping", () => {
  it("builds generic payload by default", () => {
    const mapped = buildLmsCompletionPayload(baseInput);
    expect(mapped.provider).toBe("GENERIC");
    expect(mapped.payload).toMatchObject({
      event: "lms.completion",
      provider: "GENERIC",
      courseCode: "INDUCT-101",
    });
  });

  it("builds moodle payload when provider is MOODLE", () => {
    const mapped = buildLmsCompletionPayload({
      ...baseInput,
      provider: "moodle",
    });

    expect(mapped.provider).toBe("MOODLE");
    expect(mapped.payload).toMatchObject({
      provider: "MOODLE",
      moodleCompletion: {
        activityCode: "INDUCT-101",
        externalUserRef: "signin-1",
      },
    });
  });

  it("builds scorm cloud payload when provider is SCORM_CLOUD", () => {
    const mapped = buildLmsCompletionPayload({
      ...baseInput,
      provider: "Scorm Cloud",
    });

    expect(mapped.provider).toBe("SCORM_CLOUD");
    expect(mapped.payload).toMatchObject({
      provider: "SCORM_CLOUD",
      scormCloud: {
        registrationId: "signin-1",
        courseId: "INDUCT-101",
      },
    });
  });
});
