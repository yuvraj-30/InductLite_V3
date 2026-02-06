import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@prisma/client";

const mockDb = vi.hoisted(() => ({
  signInRecord: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/db/public-db", () => ({
  publicDb: mockDb,
}));

// Import after mocking
import { findPublicSignInById } from "../public-signin.repository";

type PublicSignInRecord = Prisma.SignInRecordGetPayload<{
  select: {
    id: true;
    visitor_name: true;
    sign_in_ts: true;
    sign_out_ts: true;
    site: { select: { name: true } };
    company: { select: { name: true } };
  };
}>;

function createMockRecord(
  overrides: Partial<PublicSignInRecord> = {},
): PublicSignInRecord {
  return {
    id: "s-public-1",
    visitor_name: "Alice",
    sign_in_ts: new Date("2023-01-01T10:00:00Z"),
    sign_out_ts: null,
    site: { name: "Main Site" },
    company: { name: "Acme Corp" },
    ...overrides,
  } as PublicSignInRecord;
}

describe("PublicSignIn Repository - findPublicSignInById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when record is not found", async () => {
    vi.mocked(mockDb.signInRecord.findFirst).mockResolvedValue(null);

    const res = await findPublicSignInById("missing-id");

    expect(res).toBeNull();
    expect(mockDb.signInRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "missing-id" } }),
    );
  });

  it("maps and returns record fields when found (active sign-in)", async () => {
    const mock = createMockRecord();
    vi.mocked(mockDb.signInRecord.findFirst).mockResolvedValue(mock);

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

  it("returns sign-out time when already signed out", async () => {
    const mock = createMockRecord({
      sign_out_ts: new Date("2023-01-01T12:00:00Z"),
    });
    vi.mocked(mockDb.signInRecord.findFirst).mockResolvedValue(mock);

    const res = await findPublicSignInById("s-public-1");

    expect(res).not.toBeNull();
    expect(res?.signOutTime).toEqual(new Date("2023-01-01T12:00:00Z"));
  });
});
