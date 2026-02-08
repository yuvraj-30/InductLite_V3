/// <reference types="vitest/globals" />// Test setup file
import fs from "fs";
import path from "path";
import { parse as parseEnv } from "dotenv";

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const parsed = parseEnv(fs.readFileSync(filePath));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

if (process.env.UPSTASH_TESTS === "1") {
  const appRoot = path.resolve(__dirname, "../../../");
  loadEnvFile(path.join(appRoot, ".env"));
  loadEnvFile(path.join(appRoot, ".env.local"));
}

// Mock environment variables
process.env.SESSION_SECRET = "test-secret-at-least-32-characters-long";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

// Reset mocks between tests
