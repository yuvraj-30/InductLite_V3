export interface QuizQuestionForScoring {
  id: string;
  questionType?: string;
  correctAnswer?: unknown;
}

export interface QuizAnswerForScoring {
  questionId: string;
  answer: unknown;
}

export interface QuizScoreEvaluation {
  gradedQuestionCount: number;
  correctCount: number;
  scorePercent: number;
  passed: boolean;
}

function normalizeYesNoValue(value: unknown): "yes" | "no" | null {
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }

  if (typeof value === "number") {
    if (value === 1) return "yes";
    if (value === 0) return "no";
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["yes", "y", "true", "1"].includes(normalized)) return "yes";
  if (["no", "n", "false", "0"].includes(normalized)) return "no";
  return null;
}

function normalizeComparableValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.trim().toLowerCase();
  }

  if (Array.isArray(value)) {
    const normalized = value.map((entry) => normalizeComparableValue(entry));
    return [...normalized].sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
  }

  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const sortedEntries = Object.keys(objectValue)
      .sort()
      .map((key) => [key, normalizeComparableValue(objectValue[key])]);
    return Object.fromEntries(sortedEntries);
  }

  return value;
}

function answersEquivalent(left: unknown, right: unknown): boolean {
  return (
    JSON.stringify(normalizeComparableValue(left)) ===
    JSON.stringify(normalizeComparableValue(right))
  );
}

function sanitizeThreshold(passThresholdPercent: number): number {
  if (!Number.isFinite(passThresholdPercent)) return 100;
  const normalized = Math.trunc(passThresholdPercent);
  return Math.max(0, Math.min(100, normalized));
}

function isAnswerCorrect(
  question: QuizQuestionForScoring,
  submittedAnswer: unknown,
): boolean {
  if (question.questionType === "YES_NO") {
    const expected = normalizeYesNoValue(question.correctAnswer);
    const actual = normalizeYesNoValue(submittedAnswer);
    if (expected !== null && actual !== null) {
      return actual === expected;
    }
  }

  return answersEquivalent(submittedAnswer, question.correctAnswer);
}

export function evaluateQuizScore(
  questions: QuizQuestionForScoring[],
  answers: QuizAnswerForScoring[],
  passThresholdPercent: number,
): QuizScoreEvaluation {
  const threshold = sanitizeThreshold(passThresholdPercent);
  const answersByQuestionId = new Map(
    answers.map((answer) => [answer.questionId, answer.answer]),
  );

  const scorableQuestions = questions.filter(
    (question) =>
      question.correctAnswer !== null && question.correctAnswer !== undefined,
  );

  let correctCount = 0;
  for (const question of scorableQuestions) {
    const submittedAnswer = answersByQuestionId.get(question.id);
    if (isAnswerCorrect(question, submittedAnswer)) {
      correctCount += 1;
    }
  }

  const gradedQuestionCount = scorableQuestions.length;
  const scorePercent =
    gradedQuestionCount === 0
      ? 100
      : Math.round((correctCount / gradedQuestionCount) * 100);

  return {
    gradedQuestionCount,
    correctCount,
    scorePercent,
    passed: scorePercent >= threshold,
  };
}
