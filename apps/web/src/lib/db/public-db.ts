import { prisma } from "@/lib/db/prisma";

/**
 * publicDb: intentionally unscoped access for allowlisted public operations.
 * Only use in well-audited places (sitePublicLink slug lookup, auth login lookup,
 * public sign-out record lookups, etc.).
 */
export const publicDb = prisma;
