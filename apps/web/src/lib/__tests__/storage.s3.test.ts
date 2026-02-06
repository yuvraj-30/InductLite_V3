import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aws-sdk/client-s3", () => {
  class MockClient {
    send = vi.fn().mockResolvedValue({});
  }
  return {
    S3Client: MockClient,
    PutObjectCommand: vi.fn(),
    GetObjectCommand: vi.fn(),
    DeleteObjectCommand: vi.fn(),
  };
});

import { writeExportFile } from "@/lib/storage";

describe("S3 storage adapter (mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STORAGE_MODE = "s3";
    process.env.EXPORTS_S3_BUCKET = "test-bucket";
  });

  it("writes file to s3 and returns storage key and size", async () => {
    const res = await writeExportFile("c1", "f.csv", "data,here\n");
    expect(res.filePath).toBe("exports/c1/f.csv");
    expect(res.size).toBeGreaterThan(0);
  });
});
