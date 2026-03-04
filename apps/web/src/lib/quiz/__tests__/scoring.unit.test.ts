import { describe, expect, it } from "vitest";
import { evaluateQuizScore } from "../scoring";

describe("evaluateQuizScore", () => {
  it("scores yes/no and text answers against a pass threshold", () => {
    const result = evaluateQuizScore(
      [
        {
          id: "q1",
          questionType: "YES_NO",
          correctAnswer: "yes",
        },
        {
          id: "q2",
          questionType: "TEXT",
          correctAnswer: "Hard hat",
        },
      ],
      [
        { questionId: "q1", answer: true },
        { questionId: "q2", answer: "hard hat" },
      ],
      80,
    );

    expect(result).toEqual({
      gradedQuestionCount: 2,
      correctCount: 2,
      scorePercent: 100,
      passed: true,
    });
  });

  it("treats checkbox answers as order-insensitive", () => {
    const result = evaluateQuizScore(
      [
        {
          id: "q1",
          questionType: "CHECKBOX",
          correctAnswer: ["helmet", "boots"],
        },
      ],
      [{ questionId: "q1", answer: ["boots", "helmet"] }],
      100,
    );

    expect(result.correctCount).toBe(1);
    expect(result.scorePercent).toBe(100);
    expect(result.passed).toBe(true);
  });

  it("fails when score is below threshold", () => {
    const result = evaluateQuizScore(
      [
        { id: "q1", questionType: "YES_NO", correctAnswer: "yes" },
        { id: "q2", questionType: "YES_NO", correctAnswer: "no" },
      ],
      [
        { questionId: "q1", answer: "yes" },
        { questionId: "q2", answer: "yes" },
      ],
      75,
    );

    expect(result).toEqual({
      gradedQuestionCount: 2,
      correctCount: 1,
      scorePercent: 50,
      passed: false,
    });
  });

  it("defaults to 100% pass when there are no scorable questions", () => {
    const result = evaluateQuizScore(
      [{ id: "q1", questionType: "TEXT", correctAnswer: null }],
      [{ questionId: "q1", answer: "anything" }],
      100,
    );

    expect(result).toEqual({
      gradedQuestionCount: 0,
      correctCount: 0,
      scorePercent: 100,
      passed: true,
    });
  });
});
