/// <reference types="vitest/globals" />// Test setup file
import { vi } from "vitest";

// Mock environment variables
process.env.SESSION_SECRET = "test-secret-at-least-32-characters-long";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
