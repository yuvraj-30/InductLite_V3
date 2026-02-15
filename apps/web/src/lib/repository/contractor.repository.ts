/**
 * Contractor Repository
 *
 * Handles all Contractor-related database operations with mandatory tenant scoping.
 */

import { scopedDb } from "@/lib/db/scoped-db";
import { publicDb } from "@/lib/db/public-db";
import type {
  Contractor,
  ContractorDocument,
  DocumentType,
  Prisma,
} from "@prisma/client";
import {
  requireCompanyId,
  handlePrismaError,
  normalizePagination,
  paginatedResult,
  type PaginationParams,
  type PaginatedResult,
  RepositoryError,
} from "./base";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import {
  decryptNullableString,
  encryptNullableString,
  encryptString,
  isDataEncryptionEnabled,
} from "@/lib/security/data-protection";

/**
 * Contractor with documents
 */
export interface ContractorWithDocuments extends Contractor {
  documents: ContractorDocument[];
}

type ContractorSensitive = {
  contact_email: string | null;
  contact_phone: string | null;
};

function decryptContractor<T extends ContractorSensitive>(contractor: T): T {
  return {
    ...contractor,
    contact_email: decryptNullableString(contractor.contact_email),
    contact_phone: decryptNullableString(contractor.contact_phone),
  };
}

function decryptContractors<T extends ContractorSensitive>(contractors: T[]): T[] {
  return contractors.map((contractor) => decryptContractor(contractor));
}

/**
 * Contractor filter options
 */
export interface ContractorFilter {
  name?: string;
  contactEmail?: string;
  contactPhone?: string;
  trade?: string;
  isActive?: boolean;
}

/**
 * Contractor creation input
 */
export interface CreateContractorInput {
  name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  trade?: string;
  notes?: string;
  is_active?: boolean;
}

/**
 * Contractor update input
 */
export interface UpdateContractorInput {
  name?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  trade?: string;
  notes?: string;
  is_active?: boolean;
}

/**
 * Document creation input
 */
export interface CreateDocumentInput {
  document_type: DocumentType;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  expires_at?: Date;
  notes?: string;
}

/**
 * Find contractor document by ID (tenant-scoped)
 */
export async function findContractorDocumentById(
  companyId: string,
  documentId: string,
): Promise<ContractorDocument | null> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const contractor = await db.contractor.findFirst({
      where: {
        company_id: companyId,
        documents: { some: { id: documentId } },
      },
      select: {
        documents: {
          where: { id: documentId },
          take: 1,
        },
      },
    });

    return contractor?.documents?.[0] ?? null;
  } catch (error) {
    handlePrismaError(error, "ContractorDocument");
  }
}

/**
 * Find a contractor document by ID scoped to a specific contractor and company.
 */
export async function findContractorDocumentForContractor(
  companyId: string,
  contractorId: string,
  documentId: string,
): Promise<ContractorDocument | null> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.contractorDocument.findFirst({
      where: {
        id: documentId,
        contractor: { is: { id: contractorId, company_id: companyId } },
      },
    });
  } catch (error) {
    handlePrismaError(error, "ContractorDocument");
  }
}

/**
 * Find contractor by ID within a company
 */
export async function findContractorById(
  companyId: string,
  contractorId: string,
): Promise<Contractor | null> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const contractor = await db.contractor.findFirst({
      where: { id: contractorId, company_id: companyId },
    });
    return contractor ? decryptContractor(contractor) : null;
  } catch (error) {
    handlePrismaError(error, "Contractor");
  }
}

/**
 * Find contractor by ID with documents
 */
export async function findContractorByIdWithDocuments(
  companyId: string,
  contractorId: string,
): Promise<ContractorWithDocuments | null> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const contractor = await db.contractor.findFirst({
      where: { id: contractorId, company_id: companyId },
      include: {
        documents: {
          orderBy: { uploaded_at: "desc" },
        },
      },
    });
    return contractor ? decryptContractor(contractor) : null;
  } catch (error) {
    handlePrismaError(error, "Contractor");
  }
}

/**
 * Find contractor by email within a company
 */
export async function findContractorByEmail(
  companyId: string,
  email: string,
): Promise<Contractor | null> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const normalizedEmail = email.toLowerCase();

    // Fast path for legacy/plaintext rows.
    const contractor = await db.contractor.findFirst({
      where: { contact_email: normalizedEmail, company_id: companyId },
    });
    if (contractor) return decryptContractor(contractor);

    // Encryption-safe fallback for ciphertext rows.
    if (isDataEncryptionEnabled()) {
      const candidates = await db.contractor.findMany({
        where: { company_id: companyId, contact_email: { not: null } },
      });
      const match = decryptContractors(candidates).find(
        (row) => row.contact_email?.toLowerCase() === normalizedEmail,
      );
      return match ?? null;
    }

    return null;
  } catch (error) {
    handlePrismaError(error, "Contractor");
  }
}

/**
 * List contractors for a company with pagination and filtering
 */
export async function listContractors(
  companyId: string,
  filter?: ContractorFilter,
  pagination?: PaginationParams,
): Promise<PaginatedResult<Contractor>> {
  requireCompanyId(companyId);

  const { skip, take, page, pageSize } = normalizePagination(pagination ?? {});

  const where: Prisma.ContractorWhereInput = {
    company_id: companyId,
    ...(filter?.name && {
      name: { contains: filter.name, mode: "insensitive" },
    }),
    ...(filter?.trade && {
      trade: { contains: filter.trade, mode: "insensitive" },
    }),
    ...(filter?.isActive !== undefined && { is_active: filter.isActive }),
  };

  try {
    const db = scopedDb(companyId);
    const requiresContactPostFilter =
      isDataEncryptionEnabled() &&
      Boolean(filter?.contactEmail || filter?.contactPhone);

    if (requiresContactPostFilter) {
      const all = decryptContractors(
        await db.contractor.findMany({
          where,
          orderBy: { name: "asc" },
        }),
      );

      const filtered = all.filter((contractor) => {
        if (filter?.contactEmail) {
          const value = contractor.contact_email?.toLowerCase() ?? "";
          if (!value.includes(filter.contactEmail.toLowerCase())) return false;
        }
        if (filter?.contactPhone) {
          const value = contractor.contact_phone ?? "";
          if (!value.includes(filter.contactPhone)) return false;
        }
        return true;
      });

      const items = filtered.slice(skip, skip + take);
      return paginatedResult(items, filtered.length, page, pageSize);
    }

    const whereWithContactFilters: Prisma.ContractorWhereInput = {
      ...where,
      ...(filter?.contactEmail && {
        contact_email: { contains: filter.contactEmail, mode: "insensitive" },
      }),
      ...(filter?.contactPhone && {
        contact_phone: { contains: filter.contactPhone },
      }),
    };

    const [contractors, total] = await Promise.all([
      db.contractor.findMany({
        where: whereWithContactFilters,
        skip,
        take,
        orderBy: { name: "asc" },
      }),
      db.contractor.count({ where: whereWithContactFilters }),
    ]);

    return paginatedResult(
      decryptContractors(contractors),
      total,
      page,
      pageSize,
    );
  } catch (error) {
    handlePrismaError(error, "Contractor");
  }
}

/**
 * List contractors with documents
 */
export async function listContractorsWithDocuments(
  companyId: string,
  filter?: ContractorFilter,
  pagination?: PaginationParams,
): Promise<PaginatedResult<ContractorWithDocuments>> {
  requireCompanyId(companyId);

  const { skip, take, page, pageSize } = normalizePagination(pagination ?? {});

  const where: Prisma.ContractorWhereInput = {
    company_id: companyId,
    ...(filter?.name && {
      name: { contains: filter.name, mode: "insensitive" },
    }),
    ...(filter?.isActive !== undefined && { is_active: filter.isActive }),
  };

  try {
    const db = scopedDb(companyId);
    const requiresEmailPostFilter =
      isDataEncryptionEnabled() && Boolean(filter?.contactEmail);

    if (requiresEmailPostFilter) {
      const all = decryptContractors(
        await db.contractor.findMany({
          where,
          orderBy: { name: "asc" },
          include: {
            documents: {
              orderBy: { uploaded_at: "desc" },
            },
          },
        }),
      );

      const filtered = all.filter((contractor) => {
        if (!filter?.contactEmail) return true;
        return (contractor.contact_email?.toLowerCase() ?? "").includes(
          filter.contactEmail.toLowerCase(),
        );
      });

      const items = filtered.slice(skip, skip + take);
      return paginatedResult(items, filtered.length, page, pageSize);
    }

    const whereWithContactFilter: Prisma.ContractorWhereInput = {
      ...where,
      ...(filter?.contactEmail && {
        contact_email: { contains: filter.contactEmail, mode: "insensitive" },
      }),
    };

    const [contractors, total] = await Promise.all([
      db.contractor.findMany({
        where: whereWithContactFilter,
        skip,
        take,
        orderBy: { name: "asc" },
        include: {
          documents: {
            orderBy: { uploaded_at: "desc" },
          },
        },
      }),
      db.contractor.count({ where: whereWithContactFilter }),
    ]);

    return paginatedResult(
      decryptContractors(contractors),
      total,
      page,
      pageSize,
    );
  } catch (error) {
    handlePrismaError(error, "Contractor");
  }
}

/**
 * Create a new contractor
 */
export async function createContractor(
  companyId: string,
  input: CreateContractorInput,
): Promise<Contractor> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);

    // Normalize and validate phone to E.164 for consistent storage
    let formattedPhone: string | undefined = undefined;
    if (input.contact_phone) {
      try {
        const pn = parsePhoneNumberFromString(
          input.contact_phone as string,
          "NZ",
        );
        if (!pn || !pn.isValid()) {
          throw new RepositoryError("Invalid phone number", "VALIDATION");
        }
        formattedPhone = pn.number; // E.164
      } catch {
        throw new RepositoryError("Invalid phone number", "VALIDATION");
      }
    }

    const created = await db.contractor.create({
      data: {
        company_id: companyId,
        name: input.name,
        contact_name: input.contact_name,
        contact_email: encryptNullableString(input.contact_email?.toLowerCase()),
        contact_phone: formattedPhone ? encryptString(formattedPhone) : null,
        trade: input.trade,
        notes: input.notes,
        is_active: input.is_active ?? true,
      },
    });
    return decryptContractor(created);
  } catch (error) {
    handlePrismaError(error, "Contractor");
  }
}

/**
 * Update a contractor
 */
export async function updateContractor(
  companyId: string,
  contractorId: string,
  input: UpdateContractorInput,
): Promise<Contractor> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);

    // First verify the contractor belongs to this company
    const existing = await db.contractor.findFirst({
      where: { id: contractorId, company_id: companyId },
    });

    if (!existing) {
      throw new Error("Contractor not found");
    }

    await db.contractor.updateMany({
      where: { id: contractorId, company_id: companyId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.contact_name !== undefined && {
          contact_name: input.contact_name,
        }),
        ...(input.contact_email !== undefined && {
          contact_email: encryptNullableString(input.contact_email?.toLowerCase()),
        }),
        ...(input.contact_phone !== undefined && {
          // Validate & normalize phone if provided
          contact_phone: ((): string | null | undefined => {
            if (input.contact_phone === undefined) return undefined;
            if (input.contact_phone === null || input.contact_phone === "") {
              return null;
            }
            // Validate & normalize phone using libphonenumber-js
            try {
              const pn = parsePhoneNumberFromString(
                input.contact_phone as string,
                "NZ",
              );
              if (!pn || !pn.isValid()) {
                throw new RepositoryError("Invalid phone number", "VALIDATION");
              }
              return encryptString(pn.number);
            } catch {
              throw new RepositoryError("Invalid phone number", "VALIDATION");
            }
          })(),
        }),
        ...(input.trade !== undefined && { trade: input.trade }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.is_active !== undefined && { is_active: input.is_active }),
      },
    });

    const updated = await db.contractor.findFirst({
      where: { id: contractorId, company_id: companyId },
    });
    if (!updated) {
      throw new RepositoryError("Contractor not found", "NOT_FOUND");
    }

    return decryptContractor(updated);
  } catch (error) {
    handlePrismaError(error, "Contractor");
  }
}

/**
 * Deactivate a contractor (soft delete)
 */
export async function deactivateContractor(
  companyId: string,
  contractorId: string,
): Promise<Contractor> {
  return updateContractor(companyId, contractorId, { is_active: false });
}

/**
 * Add document to contractor
 */
export async function addContractorDocument(
  companyId: string,
  contractorId: string,
  input: CreateDocumentInput,
): Promise<ContractorDocument> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    // First verify the contractor belongs to this company
    const contractor = await db.contractor.findFirst({
      where: { id: contractorId, company_id: companyId },
    });

    if (!contractor) {
      throw new Error("Contractor not found");
    }

    return await db.contractorDocument.create({
      data: {
        contractor_id: contractorId,
        document_type: input.document_type,
        file_name: input.file_name,
        file_path: input.file_path,
        file_size: input.file_size,
        mime_type: input.mime_type,
        expires_at: input.expires_at,
        notes: input.notes,
      },
    });
  } catch (error) {
    handlePrismaError(error, "ContractorDocument");
  }
}

/**
 * Delete contractor document
 */
export async function deleteContractorDocument(
  companyId: string,
  contractorId: string,
  documentId: string,
): Promise<void> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    // First verify the contractor belongs to this company
    const contractor = await db.contractor.findFirst({
      where: { id: contractorId, company_id: companyId },
    });

    if (!contractor) {
      throw new Error("Contractor not found");
    }

    await db.contractorDocument.deleteMany({
      where: {
        id: documentId,
        contractor: {
          is: { id: contractorId, company_id: companyId },
        },
      },
    });
  } catch (error) {
    handlePrismaError(error, "ContractorDocument");
  }
}

/**
 * System-level: list expired contractor documents for cleanup.
 */
export async function listExpiredContractorDocuments(
  companyId: string,
  limit: number = 100,
): Promise<ContractorDocument[]> {
  requireCompanyId(companyId);

  const db = scopedDb(companyId);
  const contractors = await db.contractor.findMany({
    where: {
      company_id: companyId,
      documents: { some: { expires_at: { lt: new Date() } } },
    },
    select: {
      documents: {
        where: { expires_at: { lt: new Date() } },
        orderBy: { expires_at: "asc" },
        take: limit,
      },
    },
  });

  return contractors.flatMap((c) => c.documents).slice(0, limit);
}

/**
 * System-level: delete contractor document by ID (tenant scoped by relation).
 */
export async function deleteContractorDocumentById(
  companyId: string,
  documentId: string,
): Promise<void> {
  requireCompanyId(companyId);

  await publicDb.contractorDocument.deleteMany({
    where: {
      id: documentId,
      contractor: { is: { company_id: companyId } },
    },
  });
}

/**
 * Find contractors with expiring documents
 */
export async function findContractorsWithExpiringDocuments(
  companyId: string,
  expiresWithinDays: number = 30,
): Promise<ContractorWithDocuments[]> {
  requireCompanyId(companyId);

  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + expiresWithinDays);

  try {
    const db = scopedDb(companyId);
    const contractors = await db.contractor.findMany({
      where: {
        company_id: companyId,
        is_active: true,
        documents: {
          some: {
            expires_at: {
              lte: expirationDate,
              gte: new Date(), // Not already expired
            },
          },
        },
      },
      include: {
        documents: {
          where: {
            expires_at: {
              lte: expirationDate,
              gte: new Date(),
            },
          },
          orderBy: { expires_at: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });
    return decryptContractors(contractors);
  } catch (error) {
    handlePrismaError(error, "Contractor");
  }
}

/**
 * Find contractors with expired documents
 */
export async function findContractorsWithExpiredDocuments(
  companyId: string,
): Promise<ContractorWithDocuments[]> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const contractors = await db.contractor.findMany({
      where: {
        company_id: companyId,
        is_active: true,
        documents: {
          some: {
            expires_at: {
              lt: new Date(),
            },
          },
        },
      },
      include: {
        documents: {
          where: {
            expires_at: {
              lt: new Date(),
            },
          },
          orderBy: { expires_at: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });
    return decryptContractors(contractors);
  } catch (error) {
    handlePrismaError(error, "Contractor");
  }
}

/**
 * Count active contractors in a company
 */
export async function countActiveContractors(
  companyId: string,
): Promise<number> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.contractor.count({
      where: { company_id: companyId, is_active: true },
    });
  } catch (error) {
    handlePrismaError(error, "Contractor");
  }
}
