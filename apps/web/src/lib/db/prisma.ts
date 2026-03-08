import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

declare global {
   
  var prisma: PrismaClient | undefined;
}

const prismaClientSingleton = () => {
  const connectionString =
    process.env.DATABASE_URL ?? "postgresql://invalid:invalid@localhost:5432/invalid";

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
};

export function createPrismaClient(connectionString?: string): PrismaClient {
  const resolvedConnectionString =
    connectionString ??
    process.env.DATABASE_URL ??
    "postgresql://invalid:invalid@localhost:5432/invalid";

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: resolvedConnectionString }),
  });
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

export default prisma;
