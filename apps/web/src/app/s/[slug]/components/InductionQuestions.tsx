"use client";

/**
 * Induction Questions Component
 *
 * Renders induction questions based on type:
 * - TEXT: Text input
 * - MULTIPLE_CHOICE: Radio buttons
 * - CHECKBOX: Checkboxes
 * - YES_NO: Yes/No toggle
 * - ACKNOWLEDGMENT: Checkbox acknowledgment
 */

import { type TemplateInfo } from "../actions";

interface InductionQuestionsProps {
  template: TemplateInfo;
  answers: Record<string, unknown>;
  onAnswerChange: (questionId: string, answer: unknown) => void;
  fieldErrors: Record<string, string[]>;
  missingRequiredQuestionIds?: string[];
}

export function InductionQuestions({
  template,
  answers,
  onAnswerChange,
  fieldErrors,
  missingRequiredQuestionIds = [],
}: InductionQuestionsProps) {
  return (
    <div className="space-y-6">
      <div className="kinetic-hover">
        <h2 className="kinetic-title text-xl font-black">Site Induction</h2>
        <p className="mt-1 text-sm text-secondary">
          Please complete all required questions before signing in.
        </p>
      </div>

      {template.questions.map((question, index) => (
        <div
          key={question.id}
          className={`rounded-xl border p-3 ${missingRequiredQuestionIds.includes(question.id) ? "border-red-400/45 bg-red-100/65 dark:bg-red-950/35" : "border-white/35 bg-white/45"}`}
        >
          <label
            htmlFor={`q-${question.id}`}
            className="mb-2 block text-sm font-semibold text-[color:var(--text-primary)]"
          >
            {index + 1}. {question.questionText}
            {question.isRequired && (
              <span className="text-red-500 ml-1" aria-hidden="true">
                *
              </span>
            )}
            {question.redFlag && (
              <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                Critical Safety Question
              </span>
            )}
          </label>

          {/* TEXT question */}
          {question.questionType === "TEXT" && (
            <input
              id={`q-${question.id}`}
              type="text"
              value={(answers[question.id] as string) || ""}
              autoComplete="off"
              onChange={(e) => onAnswerChange(question.id, e.target.value)}
              className="input text-base"
              placeholder="Enter your answer"
              aria-required={question.isRequired}
            />
          )}

          {/* MULTIPLE_CHOICE question */}
          {question.questionType === "MULTIPLE_CHOICE" && question.options && (
            <div className="space-y-2">
              {question.options.map((option) => (
                <label
                  key={option}
                  className="flex min-h-[48px] cursor-pointer items-center rounded-lg border border-white/35 bg-white/45 p-3 hover:bg-white/70"
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={option}
                    checked={answers[question.id] === option}
                    onChange={() => onAnswerChange(question.id, option)}
                    className="h-5 w-5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-3 text-base text-secondary">{option}</span>
                </label>
              ))}
            </div>
          )}

          {/* CHECKBOX question */}
          {question.questionType === "CHECKBOX" && question.options && (
            <div className="space-y-2">
              {question.options.map((option) => {
                const currentAnswers = (answers[question.id] as string[]) || [];
                const isChecked = currentAnswers.includes(option);
                return (
                  <label
                    key={option}
                    className="flex min-h-[48px] cursor-pointer items-center rounded-lg border border-white/35 bg-white/45 p-3 hover:bg-white/70"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        const newAnswers = isChecked
                          ? currentAnswers.filter((a) => a !== option)
                          : [...currentAnswers, option];
                        onAnswerChange(question.id, newAnswers);
                      }}
                      className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-base text-secondary">{option}</span>
                  </label>
                );
              })}
            </div>
          )}

          {/* YES_NO question */}
          {question.questionType === "YES_NO" && (
            <div className="flex space-x-4">
              <label className="flex min-h-[48px] flex-1 cursor-pointer items-center justify-center rounded-lg border border-white/35 bg-white/45 p-3 hover:bg-white/70 focus-within:ring-2 focus-within:ring-indigo-500">
                <input
                  type="radio"
                  name={question.id}
                  value="yes"
                  checked={answers[question.id] === "yes"}
                  onChange={() => onAnswerChange(question.id, "yes")}
                  className="h-5 w-5 text-green-600 focus:ring-green-500"
                  aria-required={question.isRequired}
                />
                <span className="ml-2 text-base font-medium text-green-700">Yes</span>
              </label>
              <label className="flex min-h-[48px] flex-1 cursor-pointer items-center justify-center rounded-lg border border-white/35 bg-white/45 p-3 hover:bg-white/70 focus-within:ring-2 focus-within:ring-indigo-500">
                <input
                  type="radio"
                  name={question.id}
                  value="no"
                  checked={answers[question.id] === "no"}
                  onChange={() => onAnswerChange(question.id, "no")}
                  className="h-5 w-5 text-red-600 focus:ring-red-500"
                  aria-required={question.isRequired}
                />
                <span className="ml-2 text-base font-medium text-red-700">No</span>
              </label>
            </div>
          )}

          {/* ACKNOWLEDGMENT question */}
          {question.questionType === "ACKNOWLEDGMENT" && (
            <label className="flex min-h-[48px] cursor-pointer items-start rounded-lg border border-white/35 bg-white/45 p-3 hover:bg-white/70">
              <input
                type="checkbox"
                checked={answers[question.id] === true}
                onChange={(e) => onAnswerChange(question.id, e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="ml-3 text-base text-secondary">
                I acknowledge and agree to the above
              </span>
            </label>
          )}
        </div>
      ))}

      {/* Show any answer errors */}
      {fieldErrors.answers && (
        <div className="rounded-lg border border-red-400/45 bg-red-100/70 p-3 dark:bg-red-950/45">
          <p className="text-sm text-red-900 dark:text-red-100">{fieldErrors.answers[0]}</p>
        </div>
      )}
    </div>
  );
}
