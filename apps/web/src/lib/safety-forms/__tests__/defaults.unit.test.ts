import { describe, expect, it } from "vitest";
import {
  DEFAULT_SAFETY_FORM_TEMPLATES,
  resolveDefaultSafetyTemplate,
} from "../defaults";

describe("safety form defaults", () => {
  it("includes all required construction form packs", () => {
    const types = DEFAULT_SAFETY_FORM_TEMPLATES.map((template) => template.formType);
    expect(types).toEqual(
      expect.arrayContaining([
        "SWMS",
        "JSA",
        "RAMS",
        "TOOLBOX_TALK",
        "FATIGUE_DECLARATION",
      ]),
    );
  });

  it("resolves known template type", () => {
    const template = resolveDefaultSafetyTemplate("SWMS");
    expect(template?.name).toContain("SWMS");
    expect(template?.fieldSchema).toBeDefined();
  });
});
