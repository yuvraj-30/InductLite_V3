import fs from "fs";
import path from "path";
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

  it("keeps lower-half compliance controls behind disclosure sections", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "compliance-settings-form.tsx"),
      "utf8",
    );

    expect(source).toContain("AdminDisclosureSection");
    expect(source).toContain("Retention windows");
    expect(source).toContain("Data residency record");
  });
});
