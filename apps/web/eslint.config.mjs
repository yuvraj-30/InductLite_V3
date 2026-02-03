import { dirname } from "path";
import { fileURLToPath } from "url";

// CRITICAL: Import local security plugin
import securityPlugin from "./eslint-plugin-security/index.js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [
  // ============================================
  // BLOCK A: Global Ignores
  // ============================================
  {
    ignores: [
      "**/node_modules/",
      "**/.next/",
      "**/dist/",
      "**/coverage/",
      "**/playwright-report/",
      "**/eslint-plugin-security/",
      "scripts/",
      "**/*.config.js",
      "**/*.config.mjs",
      "**/*.config.cjs",
      "reset-admin.js",
    ],
  },

  // ============================================
  // BLOCK B: TypeScript Configuration
  // ============================================
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // ============================================
  // BLOCK D: Global Rules (JS files)
  // ============================================
  {
    files: ["**/*.js", "**/*.jsx"],
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // ============================================
  // BLOCK D1: Global Rules (TS files)
  // ============================================
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // ============================================
  // BLOCK D2: Tests exemption
  // Allow using `any` within test / spec files for mocking and quick fixtures
  // ============================================
  {
    files: [
      "**/__tests__/**",
      "tests/**",
      "e2e/**",
      "**/*.spec.ts",
      "**/*.test.ts",
    ],
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-console": "off",
    },
  },

  // ============================================
  // BLOCK E: Security Guardrails Plugin
  // ============================================
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    plugins: {
      "security-guardrails": securityPlugin,
    },
    rules: {
      "security-guardrails/no-raw-sql": "error",
      "security-guardrails/require-company-id": "warn",
      "security-guardrails/no-env-secrets-client": "error",
      "security-guardrails/require-csrf-check": [
        "warn",
        {
          // Public flows that are intentionally unprotected (use rate limiting instead)
          allowedUnprotectedFunctions: [
            "getSiteForSignIn",
            "submitSignIn",
            "submitSignOut",
          ],
          // Only flag actual data mutations, not helper functions like createRequestLogger
          mutationPatterns: [
            "createPublicSignIn",
            "createAuditLog",
            "signOutWithToken",
            "\\.create\\(",
            "\\.update\\(",
            "\\.delete\\(",
            "\\.upsert\\(",
          ],
        },
      ],
    },
  },
  // ============================================
  // BLOCK F: Repository import restrictions
  // Enforce that repositories use scopedDb/publicDb instead of raw prisma
  {
    files: ["src/lib/repository/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db/prisma",
              message:
                "Importing raw prisma is disallowed in repositories. Use scopedDb(companyId) or publicDb instead.",
            },
          ],
        },
      ],
    },
  },
  // Allowlist: some repository files intentionally use raw Prisma for well-audited public lookups
  {
    files: [
      "src/lib/repository/public-signin.repository.ts",
      "src/lib/repository/site.repository.ts",
      "src/lib/repository/template.repository.ts",
      "src/lib/repository/question.repository.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // Test-only API routes (used by E2E) - relax all rules
  {
    files: ["src/app/api/test/**/*.ts", "src/app/api/test/**/*.tsx"],
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "security-guardrails/no-raw-sql": "off",
      "security-guardrails/require-company-id": "off",
      "security-guardrails/require-csrf-check": "off",
    },
  },

  // Config files - relax rules
  {
    files: ["*.config.cjs", "*.config.js", "reset-admin.js"],
    rules: {
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
