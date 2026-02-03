/* eslint-disable no-restricted-imports */
import type { Prisma } from "@prisma/client";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RepositoryError } from "../base";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    inductionTemplate: {
      findFirst: vi.fn(),
    },
    inductionQuestion: {
      findMany: vi.fn(),
      update: vi.fn(),
      createMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((cb) =>
      cb({
        inductionTemplate: { findFirst: vi.fn() },
        inductionQuestion: {
          findMany: vi.fn(),
          update: vi.fn(),
          createMany: vi.fn(),
        },
      }),
    ),
  },
}));

import { prisma } from "@/lib/db/prisma";
import type { QuestionType, CreateQuestionInput } from "../question.repository";
import { reorderQuestions, bulkCreateQuestions } from "../question.repository";

describe("Question Repository Bulk Operations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reorderQuestions should validate ids and update in a transaction", async () => {
    // Mock $transaction callback args

    vi.mocked(prisma.$transaction).mockImplementation(
      async (
        cb: (tx: import("@prisma/client").Prisma.TransactionClient) => any,
      ) => {
        const tx = {
          inductionTemplate: {
            findFirst: vi
              .fn()
              .mockResolvedValue({ is_archived: false, is_published: false }),
          },
          inductionQuestion: {
            findMany: vi.fn().mockResolvedValue([{ id: "q1" }, { id: "q2" }]),
            update: vi.fn().mockResolvedValue({}),
          },
        } as unknown as Prisma.TransactionClient;

        return cb(tx);
      },
    );

    await reorderQuestions("company-123", "template-1", [
      { questionId: "q1", newOrder: 2 },
      { questionId: "q2", newOrder: 1 },
    ]);

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("reorderQuestions should throw if an id does not belong to template", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(
      async (cb: (tx: Prisma.TransactionClient) => any) => {
        const tx = {
          inductionTemplate: {
            findFirst: vi
              .fn()
              .mockResolvedValue({ is_archived: false, is_published: false }),
          },
          inductionQuestion: {
            findMany: vi.fn().mockResolvedValue([{ id: "q1" }]),
            update: vi.fn(),
          },
        } as unknown as Prisma.TransactionClient;

        return cb(tx);
      },
    );

    await expect(
      reorderQuestions("company-123", "template-1", [
        { questionId: "q1", newOrder: 2 },
        { questionId: "qX", newOrder: 1 },
      ]),
    ).rejects.toThrow(RepositoryError);
  });

  it("bulkCreateQuestions should create questions and return them", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(
      async (cb: (tx: Prisma.TransactionClient) => any) => {
        const created = [
          { id: "q1", display_order: 1 },
          { id: "q2", display_order: 2 },
        ];
        const tx = {
          inductionTemplate: {
            findFirst: vi
              .fn()
              .mockResolvedValue({ is_archived: false, is_published: false }),
          },
          inductionQuestion: {
            createMany: vi.fn().mockResolvedValue({}),
            findMany: vi.fn().mockResolvedValue(created),
          },
        } as unknown as Prisma.TransactionClient;

        return cb(tx);
      },
    );

    const res = await bulkCreateQuestions("company-123", "template-1", [
      { question_text: "Q1", question_type: "TEXT" as QuestionType },
      { question_text: "Q2", question_type: "TEXT" as QuestionType },
    ] as CreateQuestionInput[]);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(res.length).toBe(2);
  });

  it("bulkCreateQuestions should reject when template not editable", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(
      async (cb: (tx: Prisma.TransactionClient) => any) => {
        const tx = {
          inductionTemplate: { findFirst: vi.fn().mockResolvedValue(null) },
          inductionQuestion: { createMany: vi.fn(), findMany: vi.fn() },
        } as unknown as Prisma.TransactionClient;

        return cb(tx);
      },
    );

    await expect(
      bulkCreateQuestions("company-123", "template-1", [
        { question_text: "Q", question_type: "TEXT" as QuestionType },
      ] as CreateQuestionInput[]),
    ).rejects.toThrow(RepositoryError);
  });
});
