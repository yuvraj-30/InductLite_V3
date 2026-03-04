import { describe, expect, it } from "vitest";
import {
  getInductionLanguageChoices,
  getInductionLanguageVariant,
  hasInductionLanguageVariants,
  parseInductionLanguageConfig,
  resolveInductionLanguageSelection,
} from "../language-config";

describe("template language config parser", () => {
  it("returns defaults for invalid input", () => {
    const config = parseInductionLanguageConfig(null);

    expect(config.defaultLanguage).toBe("en");
    expect(config.variants).toEqual([]);
    expect(hasInductionLanguageVariants(config)).toBe(false);
    expect(getInductionLanguageChoices(config)).toEqual([
      { code: "en", label: "English" },
    ]);
  });

  it("parses language variants with question overrides", () => {
    const config = parseInductionLanguageConfig({
      defaultLanguage: "en-NZ",
      variants: [
        {
          languageCode: "mi",
          label: "Te Reo Maori",
          templateName: "Whakauru Pae",
          acknowledgementLabel: "Kua panui ahau i nga rauemi.",
          questions: [
            {
              questionId: "c123456789012345678901234",
              questionText: "Kei te mau koe i te PPE tika?",
              optionLabels: ["Ae", "Kao"],
            },
          ],
        },
      ],
    });

    expect(config.defaultLanguage).toBe("en-nz");
    expect(config.variants).toHaveLength(1);
    const firstVariant = config.variants.at(0);
    expect(firstVariant).toBeDefined();
    if (!firstVariant) {
      throw new Error("Expected first variant");
    }
    expect(firstVariant).toMatchObject({
      languageCode: "mi",
      label: "Te Reo Maori",
      templateName: "Whakauru Pae",
      acknowledgementLabel: "Kua panui ahau i nga rauemi.",
    });
    expect(firstVariant.questions.at(0)).toMatchObject({
      questionId: "c123456789012345678901234",
      questionText: "Kei te mau koe i te PPE tika?",
      optionLabels: ["Ae", "Kao"],
    });
    expect(hasInductionLanguageVariants(config)).toBe(true);
  });

  it("drops invalid variants and normalizes language selection", () => {
    const config = parseInductionLanguageConfig({
      defaultLanguage: "en",
      variants: [
        { languageCode: " ", label: "Invalid" },
        {
          languageCode: "zh_CN",
          label: "Chinese (Simplified)",
          templateDescription: "Read this before entry.",
        },
      ],
    });

    expect(config.variants).toHaveLength(1);
    const firstVariant = config.variants.at(0);
    expect(firstVariant).toBeDefined();
    if (!firstVariant) {
      throw new Error("Expected first variant");
    }
    expect(firstVariant.languageCode).toBe("zh-cn");
    expect(resolveInductionLanguageSelection(config, "zh-CN")).toBe("zh-cn");
    expect(resolveInductionLanguageSelection(config, "fil")).toBe("en");
    expect(
      getInductionLanguageVariant(config, "zh-cn")?.templateDescription,
    ).toBe("Read this before entry.");
  });
});
