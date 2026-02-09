import { defineConfig } from "vitest/config";
import { resolve } from "path";

/**
 * Vitest Configuration for Integration Tests
 *
 * Runs tests that require real PostgreSQL via Testcontainers.
 * These tests are slower but verify actual database behavior.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/**/*.{test,spec}.ts"],
    exclude: ["node_modules", ".next"],
    // Longer timeout for container startup
    testTimeout: 120000, // 2 minutes
    hookTimeout: 120000,
    // Run tests sequentially to avoid container conflicts
    sequence: {
      concurrent: false,
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", ".next/", "**/*.d.ts", "prisma/", "tests/"],
    },
    // Use separate setup file for integration tests
    setupFiles: ["./tests/integration/vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
