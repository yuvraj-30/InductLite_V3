/**
 * Integration Test Setup
 *
 * Environment configuration for integration tests.
 * Does NOT import the main test setup to avoid mock conflicts.
 */

import { vi } from "vitest";

// Set test environment variables
// NODE_ENV is read-only in TypeScript, but it's already 'test' from vitest
process.env.SIGN_OUT_TOKEN_SECRET = "test-integration-secret-key-32chars!";
process.env.SESSION_SECRET = "test-session-secret-for-integration-tests!";

// Suppress console during tests (optional)
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "info").mockImplementation(() => {});
