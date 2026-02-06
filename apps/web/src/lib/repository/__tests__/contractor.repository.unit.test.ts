/* eslint-disable no-restricted-imports */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DocumentType } from "@prisma/client";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    contractor: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    contractorDocument: {
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

// Import after mocking
import { prisma } from "@/lib/db/prisma";
import {
  findContractorById,
  createContractor,
  updateContractor,
  addContractorDocument,
  deleteContractorDocument,
  countActiveContractors,
} from "../contractor.repository";

import type { Contractor } from "@prisma/client";

function createMockContractor(overrides: Partial<Contractor> = {}): Contractor {
  return {
    id: "c1",
    company_id: "company-123",
    name: "Acme",
    contact_name: "Joe",
    contact_email: "joe@acme.com",
    contact_phone: "123",
    trade: null,
    notes: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as Contractor;
}

describe("Contractor Repository (unit)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("findContractorById should call prisma with company scope", async () => {
    vi.mocked(prisma.contractor.findFirst).mockResolvedValue(null);

    await findContractorById("company-123", "c1");

    expect(prisma.contractor.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ id: "c1", company_id: "company-123" }),
            expect.objectContaining({ company_id: "company-123" }),
          ]),
        }),
      }),
    );
  });

  it("createContractor should inject company_id via scopedDb", async () => {
    const mock = createMockContractor();
    vi.mocked(prisma.contractor.create).mockResolvedValue(mock);

    await createContractor("company-123", { name: "Acme" });

    expect(prisma.contractor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Acme",
          company_id: "company-123",
        }),
      }),
    );
  });

  it("createContractor should format contact phone to E.164 when provided", async () => {
    const mock = createMockContractor({ contact_phone: "+6441234567" });
    vi.mocked(prisma.contractor.create).mockResolvedValue(mock);

    await createContractor("company-123", {
      name: "Acme",
      contact_phone: "041234567",
    });

    expect(prisma.contractor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contact_phone: "+6441234567" }),
      }),
    );
  });

  it("createContractor should reject invalid phone numbers", async () => {
    await expect(
      createContractor("company-123", {
        name: "Acme",
        contact_phone: "not-a-phone",
      } as unknown as import("../contractor.repository").CreateContractorInput),
    ).rejects.toThrow(/Invalid phone number/);
  });

  it("updateContractor should use updateMany and return updated record", async () => {
    const mock = createMockContractor({ name: "After" });
    vi.mocked(prisma.contractor.findFirst).mockResolvedValueOnce(
      createMockContractor(),
    );
    vi.mocked(prisma.contractor.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.contractor.findFirst).mockResolvedValue(mock);

    const result = await updateContractor("company-123", "c1", {
      name: "After",
    });

    expect(prisma.contractor.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ id: "c1", company_id: "company-123" }),
            expect.objectContaining({ company_id: "company-123" }),
          ]),
        }),
      }),
    );

    expect(result!.name).toBe("After");
  });

  it("addContractorDocument should create a document for an existing contractor", async () => {
    vi.mocked(prisma.contractor.findFirst).mockResolvedValue(
      createMockContractor(),
    );
    vi.mocked(prisma.contractorDocument.create).mockResolvedValue({
      id: "d1",
      file_path: "/tmp/f.pdf",
      file_name: "f.pdf",
      file_size: 123,
      expires_at: null,
      notes: null,
      contractor_id: "c1",
      document_type: DocumentType.INSURANCE,
      mime_type: "application/pdf",
      uploaded_at: new Date(),
    } as import("@prisma/client").ContractorDocument);

    const res = await addContractorDocument("company-123", "c1", {
      document_type: DocumentType.INSURANCE,
      file_name: "f.pdf",
      file_path: "/tmp/f.pdf",
      file_size: 123,
      mime_type: "application/pdf",
    });

    expect(prisma.contractorDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contractor_id: "c1" }),
      }),
    );

    expect(res.id).toBe("d1");
  });

  it("deleteContractorDocument should call deleteMany with nested contractor relation scoping", async () => {
    vi.mocked(prisma.contractor.findFirst).mockResolvedValue(
      createMockContractor(),
    );

    await deleteContractorDocument("company-123", "c1", "d1");

    expect(prisma.contractorDocument.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              id: "d1",
              contractor: { is: { id: "c1", company_id: "company-123" } },
            }),
            expect.objectContaining({
              contractor: { company_id: "company-123" },
            }),
          ]),
        }),
      }),
    );
  });

  it("deleteContractorDocument should throw when contractor not found and not call deleteMany", async () => {
    vi.mocked(prisma.contractor.findFirst).mockResolvedValue(null);

    await expect(
      deleteContractorDocument("company-123", "missing", "d1"),
    ).rejects.toThrow("Contractor not found");

    expect(prisma.contractorDocument.deleteMany).not.toHaveBeenCalled();
  });

  it("countActiveContractors should call count with company scope", async () => {
    vi.mocked(prisma.contractor.count).mockResolvedValue(2);

    const n = await countActiveContractors("company-123");

    expect(prisma.contractor.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              is_active: true,
              company_id: "company-123",
            }),
            expect.objectContaining({ company_id: "company-123" }),
          ]),
        }),
      }),
    );

    expect(n).toBe(2);
  });
});
