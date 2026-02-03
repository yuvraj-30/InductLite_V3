/**
 * User Repository
 *
 * Handles all User-related database operations with mandatory tenant scoping.
 */

import { scopedDb } from "@/lib/db/scoped-db";
import { publicDb } from "@/lib/db/public-db";
import type { User, UserRole, Prisma } from "@prisma/client";
import {
  requireCompanyId,
  handlePrismaError,
  normalizePagination,
  paginatedResult,
  type PaginationParams,
  type PaginatedResult,
} from "./base";

/**
 * User data without sensitive fields
 */
export type SafeUser = Omit<User, "password_hash">;

/**
 * Convert User to SafeUser by removing password_hash
 */
function toSafeUser(user: User): SafeUser {
   
  const { password_hash: _, ...safeUser } = user;
  return safeUser;
}

/**
 * User filter options
 */
export interface UserFilter {
  email?: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
}

/**
 * User creation input
 */
export interface CreateUserInput {
  email: string;
  name: string;
  password_hash: string;
  role: UserRole;
  is_active?: boolean;
}

/**
 * User update input
 */
export interface UpdateUserInput {
  email?: string;
  name?: string;
  password_hash?: string;
  role?: UserRole;
  is_active?: boolean;
}

/**
 * Find user by ID within a company
 */
export async function findUserById(
  companyId: string,
  userId: string,
): Promise<SafeUser | null> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);

    const user = await db.user.findFirst({
      where: { id: userId, company_id: companyId },
    });

    return user ? toSafeUser(user as User) : null;
  } catch (error) {
    handlePrismaError(error, "User");
  }
}

/**
 * Find user by email within a company
 */
export async function findUserByEmail(
  companyId: string,
  email: string,
): Promise<SafeUser | null> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);

    const user = await db.user.findFirst({
      where: { company_id: companyId, email: email.toLowerCase() },
    });

    return user ? toSafeUser(user as User) : null;
  } catch (error) {
    handlePrismaError(error, "User");
  }
}

/**
 * Find user by email with password hash (for auth)
 * INTERNAL USE ONLY - includes sensitive data
 */
export async function findUserByEmailWithPassword(
  companyId: string,
  email: string,
): Promise<User | null> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return (await db.user.findFirst({
      where: { company_id: companyId, email: email.toLowerCase() },
    })) as User | null;
  } catch (error) {
    handlePrismaError(error, "User");
  }
}

/**
 * Find user by email across all companies (for login)
 * INTERNAL USE ONLY - includes sensitive data
 * Returns user with company data for login flow
 */
export async function findUserForLogin(
  email: string,
): Promise<
  (User & { company: { id: string; name: string; slug: string } }) | null
> {
  try {
    // eslint-disable-next-line security-guardrails/require-company-id -- login requires cross-company user lookup
    return (await publicDb.user.findFirst({
      where: {
        email: email.toLowerCase(),
        is_active: true,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    })) as
      | (User & { company: { id: string; name: string; slug: string } })
      | null;
  } catch (error) {
    handlePrismaError(error, "User");
  }
}

/**
 * List users for a company with pagination and filtering
 */
export async function listUsers(
  companyId: string,
  filter?: UserFilter,
  pagination?: PaginationParams,
): Promise<PaginatedResult<SafeUser>> {
  requireCompanyId(companyId);

  const { skip, take, page, pageSize } = normalizePagination(pagination ?? {});

  const where: Prisma.UserWhereInput = {
    company_id: companyId,
    ...(filter?.email && {
      email: { contains: filter.email, mode: "insensitive" },
    }),
    ...(filter?.name && {
      name: { contains: filter.name, mode: "insensitive" },
    }),
    ...(filter?.role && { role: filter.role }),
    ...(filter?.isActive !== undefined && { is_active: filter.isActive }),
  };

  try {
    const db = scopedDb(companyId);

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        skip,
        take,
        orderBy: { name: "asc" },
      }),
      db.user.count({ where }),
    ]);

    return paginatedResult(
      (users as User[]).map(toSafeUser),
      total,
      page,
      pageSize,
    );
  } catch (error) {
    handlePrismaError(error, "User");
  }
}

/**
 * Create a new user
 */
export async function createUser(
  companyId: string,
  input: CreateUserInput,
): Promise<SafeUser> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);

    const user = (await db.user.create({
      data: {
        company_id: companyId,
        email: input.email.toLowerCase(),
        name: input.name,
        password_hash: input.password_hash,
        role: input.role,
        is_active: input.is_active ?? true,
      },
    })) as User;

    return toSafeUser(user);
  } catch (error) {
    handlePrismaError(error, "User");
  }
}

/**
 * Update a user
 */
export async function updateUser(
  companyId: string,
  userId: string,
  input: UpdateUserInput,
): Promise<SafeUser> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);

    // First verify the user belongs to this company
    const existing = (await db.user.findFirst({
      where: { id: userId, company_id: companyId },
    })) as User | null;

    if (!existing) {
      throw new Error("User not found");
    }

    // Use updateMany to avoid unsafe unique operations; scopedDb enforces company filter
    await db.user.updateMany({
      where: { id: userId, company_id: companyId },
      data: {
        ...(input.email && { email: input.email.toLowerCase() }),
        ...(input.name && { name: input.name }),
        ...(input.password_hash && { password_hash: input.password_hash }),
        ...(input.role && { role: input.role }),
        ...(input.is_active !== undefined && { is_active: input.is_active }),
      },
    });

    const updated = await db.user.findFirst({
      where: { id: userId, company_id: companyId },
    });
    return updated
      ? toSafeUser(updated as User)
      : (() => {
          throw new Error("User update failed");
        })();
  } catch (error) {
    handlePrismaError(error, "User");
  }
}

/**
 * Deactivate a user (soft delete)
 */
export async function deactivateUser(
  companyId: string,
  userId: string,
): Promise<SafeUser> {
  return updateUser(companyId, userId, { is_active: false });
}

/**
 * Reactivate a user
 */
export async function reactivateUser(
  companyId: string,
  userId: string,
): Promise<SafeUser> {
  return updateUser(companyId, userId, { is_active: true });
}

/**
 * Update user's password hash
 */
export async function updateUserPassword(
  companyId: string,
  userId: string,
  passwordHash: string,
): Promise<void> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    await db.user.updateMany({
      where: { id: userId, company_id: companyId },
      data: { password_hash: passwordHash },
    });
  } catch (error) {
    handlePrismaError(error, "User");
  }
}

/**
 * Update user's last login timestamp
 * Note: companyId required for tenant scoping validation
 */
export async function updateLastLogin(
  companyId: string,
  userId: string,
): Promise<void> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    // Verify user belongs to company before updating
    const existing = await db.user.findFirst({
      where: { id: userId, company_id: companyId },
    });

    if (!existing) {
      return; // Silently fail if user not found in company
    }

    await db.user.updateMany({
      where: { id: userId, company_id: companyId },
      data: { last_login_at: new Date() },
    });
  } catch (error) {
    // Don't throw on last_login update failure - it's not critical
    console.error("Failed to update last_login_at:", error);
  }
}

/**
 * Count active users in a company
 */
export async function countActiveUsers(companyId: string): Promise<number> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.user.count({
      where: { company_id: companyId, is_active: true },
    });
  } catch (error) {
    handlePrismaError(error, "User");
  }
}
