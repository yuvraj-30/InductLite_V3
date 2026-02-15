import { describe, expect, it } from "vitest";
import { guardrailDeniedResponse } from "@/lib/api";

describe("guardrail denial payloads", () => {
  it("returns deterministic guardrail fields", () => {
    const response = guardrailDeniedResponse(
      "EXPT-003",
      "MAX_EXPORT_DOWNLOAD_BYTES_PER_COMPANY_PER_DAY=536870912",
      "tenant",
      "Export download quota reached",
    );

    expect(response).toEqual({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Export download quota reached",
        fieldErrors: undefined,
        guardrail: {
          controlId: "EXPT-003",
          violatedLimit: "MAX_EXPORT_DOWNLOAD_BYTES_PER_COMPANY_PER_DAY=536870912",
          scope: "tenant",
        },
      },
    });
  });
});
