// CRITICAL: Import local security plugin (CommonJS)
const securityPlugin = require("./eslint-plugin-security/index.js");
const tseslint = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");

const eslintConfig = [
  {
    linterOptions: {
      // Keep pipelines clean: do not fail CI on unused eslint-disable directives.
      reportUnusedDisableDirectives: "off",
    },
    // Global ignore patterns
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "eslint.config*.cjs",
      "**/*.config.cjs",
      "**/eslint-plugin-security/**",
      "eslint.config*.cjs",
    ],
  },

  // TypeScript configuration
  {
    files: ["**/*.{ts,tsx}"],
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
    },
  },

  // Global rules
  {
    files: ["**/*.{ts,tsx,js,cjs,mjs}"],
    rules: {
      // No warnings allowed in CI (turbo runs eslint with --max-warnings=0)
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },

  // TypeScript rules (strict for app code)
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "security-guardrails": securityPlugin,
    },
    rules: {
      "security-guardrails/no-raw-sql": "error",
      "security-guardrails/no-env-secrets-client": "error",
      "security-guardrails/require-company-id": [
        "error",
        {
          tenantTables: [
            "site",
            "template",
            "signInRecord",
            "user",
            "contractor",
            "exportJob",
            "auditLog",
            "notification",
            "webhook",
            "apiKey",
            "inductionTemplate",
          ],
        },
      ],
      "security-guardrails/require-csrf-check": [
        "error",
        {
          allowedUnprotectedFunctions: [
            "createPublicSignInRecord",
            "completePublicSignIn",
          ],
        },
      ],

      // Reduce TS false positives
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          caughtErrors: "all",
        },
      ],
    },
  },

  // Scripts/ops utilities: allow console + relax noise
  {
    files: ["scripts/**/*.{ts,js}", "reset-admin.js"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "security-guardrails/no-raw-sql": "off",
      "security-guardrails/require-company-id": "off",
      "security-guardrails/require-csrf-check": "off",
    },
  },

  // E2E/tests: allow console + relax unused vars
  {
    files: [
      "e2e/**/*.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "**/*.test.{ts,tsx}",
      "src/**/__tests__/**/*.{ts,tsx}",
      "**/*.d.ts",
    ],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "security-guardrails/no-raw-sql": "off",
      "security-guardrails/require-company-id": "off",
      "security-guardrails/require-csrf-check": "off",
    },
  },

  // Test-only API routes (used by E2E)
  {
    files: ["src/app/api/test/**/*.{ts,tsx}"],
    rules: {
      "no-console": "off",
      "no-eval": "off",
      "security-guardrails/no-raw-sql": "off",
      "security-guardrails/require-company-id": "off",
      "security-guardrails/require-csrf-check": "off",
    },
  },
];

module.exports = eslintConfig;
