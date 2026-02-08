/**
 * Integration Test Setup
 *
 * Environment configuration for integration tests.
 * Does NOT import the main test setup to avoid mock conflicts.
 */

import fs from "fs";
import path from "path";
import { parse as parseEnv } from "dotenv";
import { vi } from "vitest";

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
  const appRoot = path.resolve(__dirname, "../../");
  loadEnvFile(path.join(appRoot, ".env"));
  loadEnvFile(path.join(appRoot, ".env.local"));
}

// Set test environment variables
// NODE_ENV is read-only in TypeScript, but it's already 'test' from vitest
process.env.SIGN_OUT_TOKEN_SECRET = "test-integration-secret-key-32chars!";
process.env.SESSION_SECRET = "test-session-secret-for-integration-tests!";

// Mock next/headers for server component testing in a test environment
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
  })),
  headers: vi.fn(() => ({
    get: vi.fn(),
  })),
}));

// Suppress console during tests (optional)
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "info").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});
