/* eslint-disable no-restricted-imports */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/public-db", () => ({
  publicDb: {
    signInRecord: {
      findUnique: vi.fn(),
    },
  },
}));

import { publicDb } from "@/lib/db/public-db";
import type { Prisma } from "@prisma/client";
import type { TokenVerificationResult } from "@/lib/auth/sign-out-token";
import { findPublicSignInById } from "../public-signin.repository";

type PublicSignInPublicPayload =
  import("@prisma/client").Prisma.SignInRecordGetPayload<{
    include: { site: true; company: true };
  }>;

function createMockRecord(
  overrides: Partial<PublicSignInPublicPayload> = {},
): PublicSignInPublicPayload {
  return {
    id: "s-public-1",
    company_id: "c1",
    site_id: "site-1",
    visitor_name: "Alice",
    visitor_phone: "+64211234567",
    visitor_email: null,
    employer_name: null,
    visitor_type: "VISITOR",
    sign_in_ts: new Date("2023-01-01T10:00:00Z"),
    sign_out_ts: null,
    notes: null,
    created_at: new Date(),
    site: { name: "Main Site" },
    company: { name: "Acme Corp" },
    ...overrides,
  } as PublicSignInPublicPayload;
}

describe("PublicSignIn Repository - findPublicSignInById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when record is not found", async () => {
    vi.mocked(publicDb.signInRecord.findUnique).mockResolvedValue(null);

    const res = await findPublicSignInById("missing-id");

    expect(res).toBeNull();
    expect(publicDb.signInRecord.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "missing-id" } }),
    );
  });

  it("returns null for empty sign-in ID", async () => {
    vi.mocked(publicDb.signInRecord.findUnique).mockResolvedValue(null);

    const res = await findPublicSignInById("");

    expect(res).toBeNull();
    expect(publicDb.signInRecord.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "" } }),
    );
  });

  it("maps and returns record fields when found (active sign-in)", async () => {
    const mock = createMockRecord();
    vi.mocked(publicDb.signInRecord.findUnique).mockResolvedValue(mock);

    const res = await findPublicSignInById("s-public-1");

    expect(res).not.toBeNull();
    expect(res).toEqual(
      expect.objectContaining({
        id: "s-public-1",
        visitorName: "Alice",
        siteName: "Main Site",
        companyName: "Acme Corp",
        signOutTime: null,
      }),
    );
  });

  it("returns signOutTime when record has been signed out (inactive)", async () => {
    const mock = createMockRecord({
      sign_out_ts: new Date("2023-01-01T12:00:00Z"),
    });
    vi.mocked(publicDb.signInRecord.findUnique).mockResolvedValue(mock);

    const res = await findPublicSignInById("s-public-1");

    expect(res).not.toBeNull();
    expect(res?.signOutTime).toEqual(new Date("2023-01-01T12:00:00Z"));
  });

  it("throws RepositoryError if underlying DB throws an error", async () => {
    vi.mocked(publicDb.signInRecord.findUnique).mockRejectedValue(
      new Error("DB down"),
    );

    await expect(findPublicSignInById("s-public-1")).rejects.toThrow(
      /Unknown error: DB down/,
    );
  });
});

// Additional tests: sign-out and creation edge cases
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    signInRecord: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/sign-out-token", () => ({
  generateSignOutToken: vi.fn(),
  verifySignOutToken: vi.fn(),
  hashSignOutToken: vi.fn(),
  compareTokenHashes: vi.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import {
  generateSignOutToken,
  verifySignOutToken,
  hashSignOutToken,
  compareTokenHashes,
} from "@/lib/auth/sign-out-token";
import {
  signOutWithToken,
  createPublicSignIn,
} from "../public-signin.repository";

describe("PublicSignIn Repository - signOutWithToken & createPublicSignIn", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns friendly error for invalid token formats", async () => {
    vi.mocked(verifySignOutToken).mockReturnValue({
      valid: false,
      error: "INVALID_FORMAT",
    });

    const res = await signOutWithToken("bad-token", "041234567");

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Invalid sign-out link/);
  });

  it("returns phone mismatch when token verification fails with PHONE_MISMATCH", async () => {
    vi.mocked(verifySignOutToken).mockReturnValue({
      valid: false,
      error: "PHONE_MISMATCH",
    });

    const res = await signOutWithToken("token", "041234567");

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Phone number does not match the sign-in record/);
  });

  it("signs out successfully when token and phone match and row updated", async () => {
    vi.mocked(verifySignOutToken).mockReturnValue({
      valid: true,
      signInRecordId: "s1",
    });
    vi.mocked(prisma.signInRecord.updateMany).mockResolvedValue({ count: 1 });

    const signedOutRecord = {
      id: "s1",
      visitor_name: "Bob",
      company_id: "c1",
      site_id: "site-1",
      visitor_phone: "+64211234567",
      visitor_email: null,
      employer_name: null,
      visitor_type: "VISITOR" as const,
      signed_out_by: null,
      notes: null,
      site: { name: "Main Site" },
      // Restored fields to preserve full mock shape (used elsewhere in flow/assertions)
      sign_in_ts: new Date(),
      sign_out_ts: null,
      sign_out_token: null,
      sign_out_token_exp: null,
      created_at: new Date(),
      updated_at: new Date(),
    } as import("@prisma/client").SignInRecord & { site: { name: string } };
    vi.mocked(prisma.signInRecord.findUnique).mockResolvedValue(
      signedOutRecord,
    );

    const res = await signOutWithToken("token", "041234567");

    expect(res.success).toBe(true);
    expect(res.visitorName).toBe("Bob");
    expect(res.companyId).toBe("c1");
    expect(res.siteName).toBe("Main Site");
  });

  it("accepts equivalent local and E.164 phone formats during verification", async () => {
    vi.mocked(verifySignOutToken).mockReturnValue({
      valid: true,
      signInRecordId: "s1",
    });
    // Simulate race where updateMany didn't update (count = 0)
    vi.mocked(prisma.signInRecord.updateMany).mockResolvedValue({ count: 0 });

    const verifyRecord = {
      id: "s1",
      company_id: "c1",
      site_id: "site-1",
      visitor_name: "Bob",
      visitor_phone: "+64211234567",
      visitor_email: null,
      employer_name: null,
      visitor_type: "VISITOR" as const,
      signed_out_by: null,
      notes: null,
      sign_in_ts: new Date(),
      sign_out_ts: null,
      sign_out_token: "h123",
      sign_out_token_exp: new Date(Date.now() + 100000),
      created_at: new Date(),
    } as import("@prisma/client").SignInRecord & { site?: { name: string } };
    vi.mocked(prisma.signInRecord.findUnique).mockResolvedValue(verifyRecord);

    vi.mocked(hashSignOutToken).mockReturnValue("h123");
    vi.mocked(compareTokenHashes).mockReturnValue(true);

    const res = await signOutWithToken("token", "021 123 4567");

    // Not a phone mismatch (E.164 comparison should match), and update failed so we get an invalid link
    expect(res.success).toBe(false);
    expect(res.error).not.toMatch(/Phone number/);
    expect(res.error).toMatch(/Invalid sign-out link/);
  });

  it("returns phone mismatch when phone formats are different and don't normalize to same E.164", async () => {
    vi.mocked(verifySignOutToken).mockReturnValue({
      valid: true,
      signInRecordId: "s1",
    } as TokenVerificationResult);
    vi.mocked(prisma.signInRecord.updateMany).mockResolvedValue({ count: 0 });

    vi.mocked(prisma.signInRecord.findUnique).mockResolvedValue({
      id: "s1",
      company_id: "c1",
      site_id: "site-1",
      visitor_name: "Bob",
      visitor_phone: "+64211234567",
      visitor_email: null,
      employer_name: null,
      visitor_type: "VISITOR",
      signed_out_by: null,
      notes: null,
      sign_in_ts: new Date(),
      sign_out_ts: null,
      sign_out_token: "h123",
      sign_out_token_exp: new Date(Date.now() + 100000),
      created_at: new Date(),
    });

    vi.mocked(hashSignOutToken).mockReturnValue("h123");

    const res = await signOutWithToken("token", "041234567");

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Phone number does not match/);
  });

  it("throws RepositoryError when DB update fails during sign-out", async () => {
    vi.mocked(verifySignOutToken).mockReturnValue({
      valid: true,
      signInRecordId: "s1",
    } as TokenVerificationResult);
    vi.mocked(prisma.signInRecord.updateMany).mockRejectedValue(
      new Error("DB down"),
    );

    await expect(signOutWithToken("token", "041234567")).rejects.toThrow(
      /Unknown error: DB down/,
    );
  });

  it("validates inputs for createPublicSignIn and rejects missing fields", async () => {
    await expect(
      createPublicSignIn(
        {} as unknown as import("../public-signin.repository").PublicSignInInput,
      ),
    ).rejects.toThrow(/Company and site are required/);

    await expect(
      createPublicSignIn({
        companyId: "c",
        siteId: "s",
        visitorName: "",
        visitorPhone: "",
      } as unknown as import("../public-signin.repository").PublicSignInInput),
    ).rejects.toThrow(/Visitor name is required/);
  });

  it("rejects invalid templateVersion", async () => {
    await expect(
      createPublicSignIn({
        companyId: "c1",
        siteId: "s1",
        visitorName: "Charlie",
        visitorPhone: "+6441234567",
        templateId: "tmpl-1",
        templateVersion: 0,
        answers: [{ questionId: "q1", answer: "yes" }],
        visitorType: "VISITOR",
      } as unknown as import("../public-signin.repository").PublicSignInInput),
    ).rejects.toThrow(/Invalid template version/);
  });

  it("rejects malformed phone numbers", async () => {
    await expect(
      createPublicSignIn({
        companyId: "c1",
        siteId: "s1",
        visitorName: "Charlie",
        visitorPhone: "not-a-phone",
        templateId: "tmpl-1",
        templateVersion: 1,
        answers: [{ questionId: "q1", answer: "yes" }],
        visitorType: "VISITOR",
      } as unknown as import("../public-signin.repository").PublicSignInInput),
    ).rejects.toThrow(/Invalid phone number/);
  });

  it("creates sign-in and induction response and persists token hash", async () => {
    const createdRecord = {
      id: "s-created",
      visitor_name: "Charlie",
      site: { name: "Main" },
      sign_in_ts: new Date(),
    };

    // Prepare tx spies with typed shape
    const tx = {
      signInRecord: {
        create: vi.fn().mockResolvedValue(createdRecord),
      },
      inductionTemplate: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: "tmpl-1", company_id: "c1", version: 1 }),
      },
      inductionResponse: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(tx),
    );
    vi.mocked(generateSignOutToken).mockReturnValue({
      token: "t123",
      expiresAt: new Date("2025-01-01T00:00:00Z"),
    });
    vi.mocked(hashSignOutToken).mockReturnValue("h123");
    vi.mocked(prisma.signInRecord.update).mockResolvedValue({
      id: "s-created",
      visitor_name: "Charlie",
      company_id: "c1",
      site_id: "site-1",
      visitor_phone: "+6441234567",
      sign_in_ts: new Date(),
      created_at: new Date(),
      visitor_email: null,
      employer_name: null,
      visitor_type: "VISITOR",
      signed_out_by: null,
      sign_out_ts: null,
      sign_out_token: null,
      sign_out_token_exp: null,
      notes: null,
    } as import("@prisma/client").SignInRecord);

    const res = await createPublicSignIn({
      companyId: "c1",
      siteId: "site-1",
      visitorName: "Charlie",
      visitorPhone: "+6441234567",
      templateId: "tmpl-1",
      templateVersion: 1,
      answers: [{ questionId: "q1", answer: "yes" }],
      visitorType: "VISITOR",
    } as unknown as import("../public-signin.repository").PublicSignInInput);

    expect(tx.signInRecord.create).toHaveBeenCalled();
    expect(tx.inductionResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ template_id: "tmpl-1", passed: true }),
      }),
    );

    expect(prisma.signInRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s-created" },
        data: expect.objectContaining({ sign_out_token: "h123" }),
      }),
    );

    expect(res.signOutToken).toBe("t123");
    expect(res.signInRecordId).toBe("s-created");
  });

  it("throws RepositoryError when persisting token hash fails", async () => {
    const createdRecord = {
      id: "s-created",
      visitor_name: "Charlie",
      site: { name: "Main" },
      sign_in_ts: new Date(),
    };

    const tx = {
      signInRecord: { create: vi.fn().mockResolvedValue(createdRecord) },
      inductionTemplate: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: "tmpl-1", company_id: "c1", version: 1 }),
      },
      inductionResponse: { create: vi.fn().mockResolvedValue({}) },
    };

    vi.mocked(prisma.$transaction).mockImplementation(
      async (
        fn: (tx: import("@prisma/client").Prisma.TransactionClient) => any,
      ) =>
        fn(tx as unknown as import("@prisma/client").Prisma.TransactionClient),
    );
    vi.mocked(generateSignOutToken).mockReturnValue({
      token: "t123",
      expiresAt: new Date("2025-01-01T00:00:00Z"),
    });
    vi.mocked(hashSignOutToken).mockReturnValue("h123");
    vi.mocked(prisma.signInRecord.update).mockRejectedValue(
      new Error("DB down"),
    );

    await expect(
      createPublicSignIn({
        companyId: "c1",
        siteId: "site-1",
        visitorName: "Charlie",
        visitorPhone: "+6441234567",
        templateId: "tmpl-1",
        templateVersion: 1,
        answers: [{ questionId: "q1", answer: "yes" }],
        visitorType: "VISITOR",
      } as unknown as import("../public-signin.repository").PublicSignInInput),
    ).rejects.toThrow(/Unknown error: DB down/);
  });

  it("throws RepositoryError when induction response creation fails (bad JSON)", async () => {
    const createdRecord = {
      id: "s-created",
      visitor_name: "Charlie",
      site: { name: "Main" },
      sign_in_ts: new Date(),
    };

    const tx = {
      signInRecord: { create: vi.fn().mockResolvedValue(createdRecord) },
      inductionTemplate: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: "tmpl-1", company_id: "c1", version: 1 }),
      },
      inductionResponse: {
        create: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
      },
    } as unknown as Prisma.TransactionClient;

    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: (tx: Prisma.TransactionClient) => any) => fn(tx),
    );
    vi.mocked(generateSignOutToken).mockReturnValue({
      token: "t123",
      expiresAt: new Date("2025-01-01T00:00:00Z"),
    });
    vi.mocked(hashSignOutToken).mockReturnValue("h123");

    await expect(
      createPublicSignIn({
        companyId: "c1",
        siteId: "site-1",
        visitorName: "Charlie",
        visitorPhone: "+6441234567",
        templateId: "tmpl-1",
        templateVersion: 1,
        answers: [
          {
            questionId: "q1",
            answer: {
              toJSON: () => {
                throw new Error("Invalid JSON");
              },
            },
          },
        ],
        visitorType: "VISITOR",
      } as unknown as import("../public-signin.repository").PublicSignInInput),
    ).rejects.toThrow(/Invalid JSON/);
  });

  it("rejects when template belongs to another company", async () => {
    const createdRecord = {
      id: "s-created",
      visitor_name: "Charlie",
      site: { name: "Main" },
      sign_in_ts: new Date(),
    };

    const tx = {
      signInRecord: { create: vi.fn().mockResolvedValue(createdRecord) },
      inductionTemplate: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as Prisma.TransactionClient;

    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: (tx: Prisma.TransactionClient) => any) => fn(tx),
    );

    await expect(
      createPublicSignIn({
        companyId: "c1",
        siteId: "site-1",
        visitorName: "Charlie",
        visitorPhone: "+6441234567",
        templateId: "tmpl-1",
        templateVersion: 1,
        answers: [{ questionId: "q1", answer: "yes" }],
        visitorType: "VISITOR",
      } as unknown as import("../public-signin.repository").PublicSignInInput),
    ).rejects.toMatchObject({ name: "RepositoryError", code: "FOREIGN_KEY" });
  });
});
