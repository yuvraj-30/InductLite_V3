import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
  createTestCompany,
  createTestSite,
  createTestSignInRecord,
  createTestUser,
} from "./setup";

// Mock S3 before importing runner to ensure our mock is used
const mockSend = vi.fn().mockResolvedValue({});
vi.mock("@aws-sdk/client-s3", () => {
  class MockClient {
    send = mockSend;
  }
  return {
    S3Client: MockClient,
    PutObjectCommand: vi.fn(),
  };
});

type Runner = typeof import("../../src/lib/export/runner");

describe("Export Job Runner - SIGN_IN_CSV to S3 (mocked)", () => {
  let prisma: PrismaClient;
  let runner: Runner;
  let company: { id: string; slug: string };
  let site: { id: string; name: string };
  let user: { id: string; email: string };
  const globalAny = globalThis as unknown as { prisma: PrismaClient };

  beforeAll(async () => {
    await setupTestDatabase();
    prisma = globalAny.prisma;
    // Set S3 mode
    process.env.STORAGE_MODE = "s3";
    process.env.EXPORTS_S3_BUCKET = "test-bucket";

    runner = await import("../../src/lib/export/runner");
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    mockSend.mockClear();
    company = await createTestCompany(prisma);
    site = await createTestSite(prisma, company.id);
    user = await createTestUser(prisma, company.id);
  });

  it("processes queued SIGN_IN_CSV job and writes to S3 (mocked)", async () => {
    await createTestSignInRecord(prisma, company.id, site.id, {
      visitorPhone: "021 123 4567",
      visitorName: "Exported Visitor",
    });

    const job = await prisma.exportJob.create({
      data: {
        company_id: company.id,
        export_type: "SIGN_IN_CSV",
        parameters: {},
        requested_by: user.id,
      },
    });

    const res = await runner.processNextExportJob();
    expect(res).not.toBeNull();
    expect(mockSend).toHaveBeenCalled();

    const updated = await prisma.exportJob.findUnique({
      where: { id: job.id },
    });
    expect(updated).not.toBeNull();
    expect(updated?.status).toBe("SUCCEEDED");
    expect(updated?.file_path).toMatch(/^exports\//);
  });
});
