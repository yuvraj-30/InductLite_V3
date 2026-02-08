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
}

export function InductionQuestions({
  template,
  answers,
  onAnswerChange,
  fieldErrors,
}: InductionQuestionsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Site Induction</h2>
        <p className="text-sm text-gray-500 mt-1">
          Please complete all required questions before signing in.
        </p>
      </div>

      {template.questions.map((question, index) => (
        <div
          key={question.id}
          className="border-b border-gray-100 pb-4 last:border-0"
        >
          <label
            htmlFor={`q-${question.id}`}
            className="block text-sm font-medium text-gray-900 mb-2"
          >
            {index + 1}. {question.questionText}
            {question.isRequired && (
              <span className="text-red-500 ml-1" aria-hidden="true">
                *
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={option}
                    checked={answers[question.id] === option}
                    onChange={() => onAnswerChange(question.id, option)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-3 text-gray-700">{option}</span>
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
                    className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
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
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
                    />
                    <span className="ml-3 text-gray-700">{option}</span>
                  </label>
                );
              })}
            </div>
          )}

          {/* YES_NO question */}
          {question.questionType === "YES_NO" && (
            <div className="flex space-x-4">
              <label className="flex-1 flex items-center justify-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer focus-within:ring-2 focus-within:ring-blue-500">
                <input
                  type="radio"
                  name={question.id}
                  value="yes"
                  checked={answers[question.id] === "yes"}
                  onChange={() => onAnswerChange(question.id, "yes")}
                  className="h-4 w-4 text-green-600 focus:ring-green-500"
                  aria-required={question.isRequired}
                />
                <span className="ml-2 font-medium text-green-700">Yes</span>
              </label>
              <label className="flex-1 flex items-center justify-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer focus-within:ring-2 focus-within:ring-blue-500">
                <input
                  type="radio"
                  name={question.id}
                  value="no"
                  checked={answers[question.id] === "no"}
                  onChange={() => onAnswerChange(question.id, "no")}
                  className="h-4 w-4 text-red-600 focus:ring-red-500"
                  aria-required={question.isRequired}
                />
                <span className="ml-2 font-medium text-red-700">No</span>
              </label>
            </div>
          )}

          {/* ACKNOWLEDGMENT question */}
          {question.questionType === "ACKNOWLEDGMENT" && (
            <label className="flex items-start p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={answers[question.id] === true}
                onChange={(e) => onAnswerChange(question.id, e.target.checked)}
                className="h-5 w-5 mt-0.5 text-blue-600 focus:ring-blue-500 rounded"
              />
              <span className="ml-3 text-gray-700">
                I acknowledge and agree to the above
              </span>
            </label>
          )}
        </div>
      ))}

      {/* Show any answer errors */}
      {fieldErrors.answers && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-700 text-sm">{fieldErrors.answers[0]}</p>
        </div>
      )}
    </div>
  );
}
