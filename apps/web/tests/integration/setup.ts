/**
 * Testcontainers Integration Test Setup
 *
 * Provides a real PostgreSQL container for integration tests.
 * Runs Prisma migrations and provides test utilities.
 */

import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

let container: StartedPostgreSqlContainer | null = null;
let prismaClient: PrismaClient | null = null;

/**
 * Start PostgreSQL container and apply schema.
 * Call this in beforeAll() for integration tests.
 */
export async function setupTestDatabase(): Promise<{
  prisma: PrismaClient;
  connectionString: string;
}> {
  // Start PostgreSQL container
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("inductlite_test")
    .withUsername("test")
    .withPassword("test")
    .withExposedPorts(5432)
    .start();

  const connectionString = container.getConnectionUri();

  // Set DATABASE_URL for Prisma BEFORE any imports happen
  process.env.DATABASE_URL = connectionString;

  // Clear any cached global Prisma client so it reconnects with new URL
  const globalAny = globalThis as unknown as { prisma?: PrismaClient };
  if (globalAny.prisma) {
    await globalAny.prisma.$disconnect();
    globalAny.prisma = undefined;
  }

  // Apply schema using db push (creates tables from schema.prisma)
  execSync(
    "npx prisma db push --accept-data-loss --skip-generate --schema prisma/schema.prisma",
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: connectionString },
      stdio: "pipe",
    },
  );

  // Create Prisma client
  prismaClient = new PrismaClient({
    datasources: {
      db: { url: connectionString },
    },
  });

  await prismaClient.$connect();

  // Set the global prisma to use our test client
  globalAny.prisma = prismaClient;

  return {
    prisma: prismaClient,
    connectionString,
  };
}

/**
 * Tear down container and disconnect.
 * Call this in afterAll() for integration tests.
 */
export async function teardownTestDatabase(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
  }

  if (container) {
    await container.stop();
    container = null;
  }
}

/**
 * Clean all data from tables (for use between tests).
 * Preserves schema but removes all rows.
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  // Delete in order respecting foreign key constraints
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.exportJob.deleteMany(),
    prisma.magicLinkToken.deleteMany(),
    prisma.contractorDocument.deleteMany(),
    prisma.contractor.deleteMany(),
    prisma.inductionResponse.deleteMany(),
    prisma.signInRecord.deleteMany(),
    prisma.inductionQuestion.deleteMany(),
    prisma.inductionTemplate.deleteMany(),
    prisma.sitePublicLink.deleteMany(),
    prisma.siteManagerAssignment.deleteMany(),
    prisma.site.deleteMany(),
    prisma.user.deleteMany(),
    prisma.company.deleteMany(),
  ]);
}

/**
 * Create test company with unique slug
 */
export async function createTestCompany(
  prisma: PrismaClient,
  overrides: { name?: string; slug?: string } = {},
): Promise<{ id: string; slug: string; name: string }> {
  const suffix = Math.random().toString(36).substring(2, 8);
  const company = await prisma.company.create({
    data: {
      name: overrides.name ?? `Test Company ${suffix}`,
      slug: overrides.slug ?? `test-company-${suffix}`,
    },
  });
  return { id: company.id, slug: company.slug, name: company.name };
}

/**
 * Create test site for a company
 */
export async function createTestSite(
  prisma: PrismaClient,
  companyId: string,
  overrides: { name?: string } = {},
): Promise<{ id: string; name: string }> {
  const suffix = Math.random().toString(36).substring(2, 8);
  const site = await prisma.site.create({
    data: {
      company_id: companyId,
      name: overrides.name ?? `Test Site ${suffix}`,
      is_active: true,
    },
  });
  return { id: site.id, name: site.name };
}

/**
 * Create test user for a company
 */
export async function createTestUser(
  prisma: PrismaClient,
  companyId: string,
  overrides: {
    email?: string;
    role?: "ADMIN" | "VIEWER" | "SITE_MANAGER";
  } = {},
): Promise<{ id: string; email: string }> {
  const suffix = Math.random().toString(36).substring(2, 8);
  const user = await prisma.user.create({
    data: {
      company_id: companyId,
      email: overrides.email ?? `user-${suffix}@test.com`,
      password_hash: "$argon2id$v=19$m=65536,t=3,p=4$placeholder", // Dummy hash
      name: `Test User ${suffix}`,
      role: overrides.role ?? "ADMIN",
      is_active: true,
    },
  });
  return { id: user.id, email: user.email };
}

/**
 * Create a test induction template
 */
export async function createTestTemplate(
  prisma: PrismaClient,
  companyId: string,
  siteId: string | null = null,
): Promise<{ id: string; version: number }> {
  const suffix = Math.random().toString(36).substring(2, 8);
  const template = await prisma.inductionTemplate.create({
    data: {
      company_id: companyId,
      site_id: siteId,
      name: `Test Template ${suffix}`,
      version: 1,
      is_published: true,
    },
  });
  return { id: template.id, version: template.version };
}

/**
 * Create a test sign-in record
 */
export async function createTestSignInRecord(
  prisma: PrismaClient,
  companyId: string,
  siteId: string,
  overrides: {
    visitorPhone?: string;
    visitorName?: string;
    signOutToken?: string | null;
    signOutTokenExp?: Date | null;
    signOutTs?: Date | null;
  } = {},
): Promise<{
  id: string;
  visitorPhone: string;
  signOutToken: string | null;
}> {
  const suffix = Math.random().toString(36).substring(2, 8);
  const record = await prisma.signInRecord.create({
    data: {
      company_id: companyId,
      site_id: siteId,
      visitor_name: overrides.visitorName ?? `Visitor ${suffix}`,
      visitor_phone: overrides.visitorPhone ?? `041234${suffix}`,
      visitor_type: "CONTRACTOR",
      sign_out_token: overrides.signOutToken ?? null,
      sign_out_token_exp: overrides.signOutTokenExp ?? null,
      sign_out_ts: overrides.signOutTs ?? null,
    },
  });
  return {
    id: record.id,
    visitorPhone: record.visitor_phone,
    signOutToken: record.sign_out_token,
  };
}

/**
 * Create a public link for a site
 */
export async function createTestPublicLink(
  prisma: PrismaClient,
  siteId: string,
): Promise<{ id: string; slug: string }> {
  const suffix = Math.random().toString(36).substring(2, 8);
  const link = await prisma.sitePublicLink.create({
    data: {
      site_id: siteId,
      slug: `public-${suffix}`,
      is_active: true,
    },
  });
  return { id: link.id, slug: link.slug };
}
