export interface QuestionLogic {
  trigger: string;
  action: "skip";
  count: number;
}

/**
 * Evaluate if a question should be skipped based on its logic and the provided answer.
 */
export function shouldSkipQuestions(logic: unknown, answer: unknown): number {
  if (!logic || typeof logic !== "object") return 0;

  const { trigger, action, count } = logic as QuestionLogic;

  if (action !== "skip" || !trigger || typeof count !== "number") return 0;

  // Normalize trigger and answer for comparison (especially for YES_NO)
  const normalizedTrigger = String(trigger).toLowerCase();
  const normalizedAnswer = String(answer).toLowerCase();

  if (normalizedTrigger === normalizedAnswer) {
    return count;
  }

  return 0;
}
