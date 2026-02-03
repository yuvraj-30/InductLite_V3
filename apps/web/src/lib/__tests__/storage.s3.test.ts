import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aws-sdk/client-s3", () => {
  class MockClient {
    send = vi.fn().mockResolvedValue({});
  }
  return {
    S3Client: MockClient,
    PutObjectCommand: vi.fn(),
  };
});

import { writeExportFile } from "@/lib/storage";

describe("S3 storage adapter (mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STORAGE_MODE = "s3";
    process.env.EXPORTS_S3_BUCKET = "test-bucket";
  });

  it("writes file to s3 and returns s3 path and size", async () => {
    const res = await writeExportFile("c1", "f.csv", "data,here\n");
    expect(res.filePath).toMatch(/^s3:\/\//);
    expect(res.size).toBeGreaterThan(0);
  });
});
