import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL;
const migrateDatabaseUrl = process.env.DATABASE_DIRECT_URL || databaseUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  ...(migrateDatabaseUrl
    ? {
        datasource: {
          url: process.env.DATABASE_DIRECT_URL
            ? env("DATABASE_DIRECT_URL")
            : env("DATABASE_URL"),
        },
      }
    : {}),
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
