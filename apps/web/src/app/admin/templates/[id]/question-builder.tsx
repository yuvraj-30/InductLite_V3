"use client";

/**
 * Question Builder Component
 *
 * Interactive question list with add/edit/delete/reorder capabilities.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addQuestionAction,
  updateQuestionAction,
  deleteQuestionAction,
  reorderQuestionsAction,
} from "../actions";
import type {
  Question,
  QuestionType,
  CreateQuestionInput,
  UpdateQuestionInput,
} from "@/lib/repository";

interface Props {
  templateId: string;
  questions: Question[];
  isEditable: boolean;
}

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "TEXT", label: "Text Answer" },
  { value: "YES_NO", label: "Yes/No" },
  { value: "MULTIPLE_CHOICE", label: "Multiple Choice" },
  { value: "CHECKBOX", label: "Checkbox (Multi-select)" },
  { value: "ACKNOWLEDGMENT", label: "Acknowledgment" },
];

function QuestionTypeIcon({ type }: { type: QuestionType }) {
  switch (type) {
    case "TEXT":
      return (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h7"
          />
        </svg>
      );
    case "YES_NO":
      return (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case "MULTIPLE_CHOICE":
      return (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      );
    case "CHECKBOX":
      return (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
          />
        </svg>
      );
    case "ACKNOWLEDGMENT":
      return (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      );
  }
}

export interface QuestionLogic {
  trigger: string;
  action: "skip";
  count: number;
}

interface QuestionFormData {
  question_text: string;
  question_type: QuestionType;
  options: string[];
  is_required: boolean;
  logic?: QuestionLogic | null;
}

function QuestionForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
}: {
  initialData?: QuestionFormData;
  onSubmit: (data: QuestionFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [questionText, setQuestionText] = useState(
    initialData?.question_text || "",
  );
  const [questionType, setQuestionType] = useState<QuestionType>(
    initialData?.question_type || "TEXT",
  );
  const [options, setOptions] = useState<string[]>(
    initialData?.options || ["", ""],
  );
  const [isRequired, setIsRequired] = useState(
    initialData?.is_required ?? true,
  );
  const [logicTrigger, setLogicTrigger] = useState(
    initialData?.logic?.trigger || "",
  );
  const [logicCount, setLogicCount] = useState(initialData?.logic?.count || 1);

  const needsOptions =
    questionType === "MULTIPLE_CHOICE" || questionType === "CHECKBOX";

  function addOption() {
    setOptions([...options, ""]);
  }

  function updateOption(index: number, value: string) {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  }

  function removeOption(index: number) {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      question_text: questionText,
      question_type: questionType,
      options: needsOptions ? options.filter((o) => o.trim() !== "") : [],
      is_required: isRequired,
      logic:
        (questionType === "YES_NO" || questionType === "MULTIPLE_CHOICE") &&
        logicTrigger
          ? { trigger: logicTrigger, action: "skip", count: logicCount }
          : null,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 bg-gray-50 p-4 rounded-lg"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Question Text
        </label>
        <textarea
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          required
          rows={2}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="Enter your question..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Question Type
          </label>
          <select
            value={questionType}
            onChange={(e) => setQuestionType(e.target.value as QuestionType)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center mt-6">
          <input
            id="is-required"
            type="checkbox"
            checked={isRequired}
            onChange={(e) => setIsRequired(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label
            htmlFor="is-required"
            className="ml-2 block text-sm text-gray-700"
          >
            Required
          </label>
        </div>
      </div>

      {needsOptions && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Options
          </label>
          {options.map((option, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="text"
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  className="px-2 text-red-600 hover:text-red-800"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            + Add Option
          </button>
        </div>
      )}

      {(questionType === "YES_NO" || questionType === "MULTIPLE_CHOICE") && (
        <div className="border-t pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Conditional Logic
          </label>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>If answer is</span>
            <select
              value={logicTrigger}
              onChange={(e) => setLogicTrigger(e.target.value)}
              className="border border-gray-300 rounded-md shadow-sm py-1 px-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">(No logic)</option>
              {questionType === "YES_NO" ? (
                <>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </>
              ) : (
                options
                  .filter((o) => o.trim() !== "")
                  .map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))
              )}
            </select>
            <span>skip</span>
            <input
              type="number"
              min="1"
              max="10"
              value={logicCount}
              onChange={(e) => setLogicCount(parseInt(e.target.value) || 1)}
              className="w-16 border border-gray-300 rounded-md shadow-sm py-1 px-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <span>questions.</span>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={isLoading || !questionText.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Saving..." : initialData ? "Update" : "Add Question"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function QuestionBuilder({ templateId, questions, isEditable }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleAdd(data: QuestionFormData) {
    setIsLoading(true);
    setError(null);

    const input: CreateQuestionInput = {
      question_text: data.question_text,
      question_type: data.question_type,
      is_required: data.is_required,
      options: data.options.length > 0 ? data.options : undefined,
      logic: data.logic || undefined,
    } as CreateQuestionInput;

    const result = await addQuestionAction(templateId, input);

    if (result.success) {
      setIsAdding(false);
      router.refresh();
    } else {
      setError(result.error.message);
    }

    setIsLoading(false);
  }

  async function handleUpdate(questionId: string, data: QuestionFormData) {
    setIsLoading(true);
    setError(null);

    const result = await updateQuestionAction(questionId, {
      question_text: data.question_text,
      question_type: data.question_type,
      is_required: data.is_required,
      options: data.options.length > 0 ? data.options : null,
      logic: data.logic || null,
    } as UpdateQuestionInput);

    if (result.success) {
      setEditingId(null);
      router.refresh();
    } else {
      setError(result.error.message);
    }

    setIsLoading(false);
  }

  async function handleDelete(questionId: string) {
    if (!confirm("Delete this question?")) return;

    setIsLoading(true);
    setError(null);

    const result = await deleteQuestionAction(questionId);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error.message);
    }

    setIsLoading(false);
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return;

    setIsLoading(true);
    const orders = questions.map((q, i) => ({
      questionId: q.id,
      newOrder: i === index ? index : i === index - 1 ? index + 1 : i + 1,
    }));

    const result = await reorderQuestionsAction(templateId, orders);

    if (!result.success) {
      setError(result.error.message);
    } else {
      router.refresh();
    }

    setIsLoading(false);
  }

  async function handleMoveDown(index: number) {
    if (index === questions.length - 1) return;

    setIsLoading(true);
    const orders = questions.map((q, i) => ({
      questionId: q.id,
      newOrder: i === index ? index + 2 : i === index + 1 ? index + 1 : i + 1,
    }));

    const result = await reorderQuestionsAction(templateId, orders);

    if (!result.success) {
      setError(result.error.message);
    } else {
      router.refresh();
    }

    setIsLoading(false);
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Question List */}
      <div className="space-y-3">
        {questions.map((question, index) => (
          <div
            key={question.id}
            className="bg-white border border-gray-200 rounded-lg p-4"
          >
            {editingId === question.id ? (
              <QuestionForm
                initialData={{
                  question_text: question.question_text,
                  question_type: question.question_type,
                  options: (question.options as string[]) || [],
                  is_required: question.is_required,
                  logic: question.logic as unknown as QuestionLogic,
                }}
                onSubmit={(data) => handleUpdate(question.id, data)}
                onCancel={() => setEditingId(null)}
                isLoading={isLoading}
              />
            ) : (
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full text-sm font-medium text-gray-600">
                    {index + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">
                        <QuestionTypeIcon type={question.question_type} />
                      </span>
                      <span className="font-medium text-gray-900">
                        {question.question_text}
                      </span>
                      {question.is_required && (
                        <span className="text-red-500 text-sm">*</span>
                      )}
                    </div>
                    {question.options &&
                      (question.options as string[]).length > 0 && (
                        <div className="mt-2 text-sm text-gray-500">
                          Options: {(question.options as string[]).join(", ")}
                        </div>
                      )}
                    {question.logic && (
                      <div className="mt-1 text-xs text-blue-600 font-medium">
                        ↳ If answer is "
                        {(question.logic as unknown as QuestionLogic).trigger}"
                        skip{" "}
                        {(question.logic as unknown as QuestionLogic).count}{" "}
                        question(s)
                      </div>
                    )}
                  </div>
                </div>

                {isEditable && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0 || isLoading}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === questions.length - 1 || isLoading}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => setEditingId(question.id)}
                      className="p-1 text-blue-600 hover:text-blue-800"
                      title="Edit"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(question.id)}
                      disabled={isLoading}
                      className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50"
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Question */}
      {isEditable && (
        <div>
          {isAdding ? (
            <QuestionForm
              onSubmit={handleAdd}
              onCancel={() => setIsAdding(false)}
              isLoading={isLoading}
            />
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors"
            >
              + Add Question
            </button>
          )}
        </div>
      )}

      {!isEditable && questions.length === 0 && (
        <p className="text-center text-gray-500 py-4">
          No questions in this template
        </p>
      )}
    </div>
  );
}
