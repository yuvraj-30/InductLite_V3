import { describe, it, expect } from "vitest";
import { shouldSkipQuestions } from "../evaluator";

describe("Logic Evaluator", () => {
  it("should return skip count when trigger matches answer", () => {
    const logic = { trigger: "yes", action: "skip", count: 2 };
    expect(shouldSkipQuestions(logic, "yes")).toBe(2);
    expect(shouldSkipQuestions(logic, "YES")).toBe(2);
  });

  it("should return 0 when trigger does not match answer", () => {
    const logic = { trigger: "yes", action: "skip", count: 2 };
    expect(shouldSkipQuestions(logic, "no")).toBe(0);
  });

  it("should return 0 for invalid logic object", () => {
    expect(shouldSkipQuestions(null, "yes")).toBe(0);
    expect(shouldSkipQuestions({}, "yes")).toBe(0);
    expect(shouldSkipQuestions({ action: "other" }, "yes")).toBe(0);
  });

  it("should handle multiple choice answers", () => {
    const logic = { trigger: "Option A", action: "skip", count: 1 };
    expect(shouldSkipQuestions(logic, "Option A")).toBe(1);
    expect(shouldSkipQuestions(logic, "Option B")).toBe(0);
  });
});
