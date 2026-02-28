import { prisma } from "@/lib/db/prisma";

export interface DatabaseReadinessResult {
  ok: boolean;
  latency_ms: number;
  error?: string;
}

/**
 * Minimal ORM readiness check shared by /health and /api/ready.
 * Uses a lightweight metadata query instead of raw SQL.
 */
export async function checkDatabaseReadiness(): Promise<DatabaseReadinessResult> {
  const start = Date.now();

  try {
    await prisma.company.findFirst({
      select: { id: true },
      orderBy: { id: "asc" },
    });
    return {
      ok: true,
      latency_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      error: error instanceof Error ? error.message : "Database unavailable",
    };
  }
}
