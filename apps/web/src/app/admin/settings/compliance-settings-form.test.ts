import { describe, expect, it } from "vitest";
import { getComplianceSettingsClientError } from "./compliance-settings-form";

describe("getComplianceSettingsClientError", () => {
  it("returns no error when legal hold is disabled", () => {
    expect(
      getComplianceSettingsClientError({
        complianceLegalHold: false,
        complianceLegalHoldReason: "",
      }),
    ).toBeNull();
  });

  it("returns an error when legal hold is enabled without a reason", () => {
    expect(
      getComplianceSettingsClientError({
        complianceLegalHold: true,
        complianceLegalHoldReason: "   ",
      }),
    ).toBe("Legal hold reason is required when legal hold is enabled");
  });

  it("returns no error when legal hold is enabled with a reason", () => {
    expect(
      getComplianceSettingsClientError({
        complianceLegalHold: true,
        complianceLegalHoldReason: "Regulator request",
      }),
    ).toBeNull();
  });
});
