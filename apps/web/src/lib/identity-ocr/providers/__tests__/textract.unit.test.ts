import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const send = vi.fn();
  const TextractClient = vi.fn(function TextractClientMock() {
    return { send };
  });
  const AnalyzeIDCommand = vi.fn(function AnalyzeIDCommandMock(input: unknown) {
    return input;
  });
  return { send, TextractClient, AnalyzeIDCommand };
});

vi.mock("@aws-sdk/client-textract", () => ({
  TextractClient: mocks.TextractClient,
  AnalyzeIDCommand: mocks.AnalyzeIDCommand,
}));

import { TextractIdentityOcrProvider } from "../textract";

const ONE_PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

describe("TextractIdentityOcrProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns APPROVED for high-confidence matching result", async () => {
    mocks.send.mockResolvedValue({
      IdentityDocuments: [
        {
          IdentityDocumentFields: [
            {
              Type: { Text: "FULL_NAME" },
              ValueDetection: { Text: "Ari Contractor", Confidence: 98 },
            },
            {
              Type: { Text: "DOCUMENT_NUMBER" },
              ValueDetection: { Text: "NZ12345", Confidence: 95 },
            },
            {
              Type: { Text: "EXPIRY_DATE" },
              ValueDetection: { Text: "2099-12-31", Confidence: 93 },
            },
            {
              Type: { Text: "DOCUMENT_TYPE" },
              ValueDetection: { Text: "PASSPORT", Confidence: 99 },
            },
          ],
        },
      ],
      $metadata: { requestId: "req-1" },
    });

    const provider = new TextractIdentityOcrProvider({
      providerKey: "TEXTRACT_AP_SOUTHEAST_2",
      region: "ap-southeast-2",
    });

    const result = await provider.verify({
      companyId: "company-1",
      siteId: "site-1",
      visitorName: "Ari Contractor",
      documentImageDataUrl: ONE_PIXEL_PNG,
      documentType: "PASSPORT",
      allowedDocumentTypes: ["PASSPORT"],
      decisionMode: "strict",
    });

    expect(result.decisionStatus).toBe("APPROVED");
    expect(result.reasonCode).toBe("OCR_CONFIDENCE_PASS");
    expect(result.provider).toBe("TEXTRACT_AP_SOUTHEAST_2");
  });

  it("returns REVIEW when strict thresholds are not met", async () => {
    mocks.send.mockResolvedValue({
      IdentityDocuments: [
        {
          IdentityDocumentFields: [
            {
              Type: { Text: "FULL_NAME" },
              ValueDetection: { Text: "Different Person", Confidence: 51 },
            },
            {
              Type: { Text: "DOCUMENT_NUMBER" },
              ValueDetection: { Text: "NZ88888", Confidence: 55 },
            },
            {
              Type: { Text: "EXPIRY_DATE" },
              ValueDetection: { Text: "2099-12-31", Confidence: 58 },
            },
          ],
        },
      ],
      $metadata: { requestId: "req-2" },
    });

    const provider = new TextractIdentityOcrProvider({
      providerKey: "TEXTRACT_AP_SOUTHEAST_2",
      region: "ap-southeast-2",
    });

    const result = await provider.verify({
      companyId: "company-1",
      siteId: "site-1",
      visitorName: "Ari Contractor",
      documentImageDataUrl: ONE_PIXEL_PNG,
      decisionMode: "strict",
    });

    expect(result.decisionStatus).toBe("REVIEW");
    expect(result.reasonCode).toBe("OCR_NAME_MISMATCH_REVIEW");
  });

  it("rejects disallowed document types before provider call", async () => {
    const provider = new TextractIdentityOcrProvider({
      providerKey: "TEXTRACT_AP_SOUTHEAST_2",
      region: "ap-southeast-2",
    });

    const result = await provider.verify({
      companyId: "company-1",
      siteId: "site-1",
      visitorName: "Ari Contractor",
      documentImageDataUrl: ONE_PIXEL_PNG,
      documentType: "PASSPORT",
      allowedDocumentTypes: ["DRIVER_LICENCE"],
      decisionMode: "assist",
    });

    expect(result.decisionStatus).toBe("REJECTED");
    expect(result.reasonCode).toBe("DOCUMENT_TYPE_NOT_ALLOWED");
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
