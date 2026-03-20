import type { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "@/lib/db/prisma";

export function getRuntimeEnv(): Partial<NodeJS.ProcessEnv> {
  try {
    return eval("process").env ?? {};
  } catch {
    return {};
  }
}

export function getRuntimeDatabaseUrl(
  env: Partial<NodeJS.ProcessEnv> = getRuntimeEnv(),
): string | null {
  const dbUrl = env.DATABASE_URL;
  return typeof dbUrl === "string" && dbUrl.trim().length > 0 ? dbUrl : null;
}

export async function connectRuntimePrisma(): Promise<PrismaClient> {
  const dbUrl = getRuntimeDatabaseUrl();
  if (!dbUrl) {
    throw new Error("DATABASE_URL not available to server process at runtime");
  }

  const client = createPrismaClient(dbUrl);
  await client.$connect();
  return client;
}

export async function withRuntimePrisma<T>(
  fn: (client: PrismaClient) => Promise<T>,
): Promise<T> {
  const client = await connectRuntimePrisma();
  try {
    return await fn(client);
  } finally {
    await client.$disconnect().catch(() => undefined);
  }
}

export function serializeRuntimeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const runtimeError = error as Error & {
      code?: string;
      meta?: unknown;
      cause?: unknown;
    };
    return {
      name: runtimeError.name,
      message: runtimeError.message,
      code: runtimeError.code ?? null,
      meta: runtimeError.meta ?? null,
      cause:
        runtimeError.cause instanceof Error
          ? runtimeError.cause.message
          : runtimeError.cause ?? null,
      stack: runtimeError.stack ?? null,
    };
  }

  return {
    name: "UnknownError",
    message: String(error ?? ""),
    code: null,
    meta: null,
    cause: null,
    stack: null,
  };
}
