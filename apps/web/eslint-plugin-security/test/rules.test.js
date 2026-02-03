const { RuleTester } = require("eslint");
const plugin = require("../index.js");

// Use a JS parser that ships with ESLint
const ruleTester = new RuleTester({
  parser: require.resolve("@typescript-eslint/parser"),
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
});

function runRuleTest(name, rule, tests) {
  try {
    console.log(`Running rule tests for: ${name}`);
    ruleTester.run(name, rule, tests);
    console.log(`✓ ${name} tests passed`);
  } catch (err) {
    console.error(`✗ ${name} tests FAILED`);
    throw err;
  }
}

// --- no-raw-sql tests ---
runRuleTest("no-raw-sql", plugin.rules["no-raw-sql"], {
  valid: ["prisma.user.findMany();", "client.$query;"],
  invalid: [
    {
      code: "prisma.$executeRaw('SELECT 1')",
      errors: [{ messageId: "noRawSql" }],
    },
    {
      code: "db.$queryRaw`SELECT * FROM users`",
      errors: [{ messageId: "noRawSql" }],
    },
  ],
});

// --- require-company-id tests ---
runRuleTest("require-company-id", plugin.rules["require-company-id"], {
  valid: [
    {
      filename: "src/lib/repository/site.repository.ts",
      code: `prisma.site.findMany({ where: { company_id: 1 } })`,
    },
    {
      filename: "src/lib/repository/other.repository.ts",
      code: `prisma.other.findMany({ where: { foo: 'bar' } })`,
    },
  ],
  invalid: [],
});

// --- no-env-secrets-client tests ---
runRuleTest("no-env-secrets-client", plugin.rules["no-env-secrets-client"], {
  valid: [
    {
      filename: "src/components/foo.tsx",
      code: `"use client"\nconst key = process.env.NEXT_PUBLIC_API_URL;`,
    },
    {
      filename: "src/server/util.ts",
      code: `const s = process.env.SESSION_SECRET;`,
    },
    // Strings that contain 'process.env.SESSION_SECRET' as literal text should be ignored
    {
      filename: "src/components/clientLiteralString.tsx",
      code: `"use client";\nconst token = 'process.env.SESSION_SECRET';`,
    },
    {
      filename: "src/components/clientTemplateLiteralPlain.tsx",
      code:
        `"use client";\nconst token = ` + "`process.env.SESSION_SECRET`" + `;`,
    },
    // JSX text nodes that contain the literal phrase should be ignored
    {
      filename: "src/components/clientJsxText.tsx",
      code: `"use client";\nconst v = <div>process.env.SESSION_SECRET</div>;`,
    },
  ],
  invalid: [
    {
      filename: "src/components/client.component.tsx",
      code: `"use client";\nconst token = process.env.SESSION_SECRET;`,
      errors: [{ messageId: "noEnvSecretsClient" }],
    },
    {
      filename: "src/components/client2.component.tsx",
      code: `"use client";\nconst key = process.env.PRIVATE_KEY;`,
      errors: [{ messageId: "noEnvSecretsClient" }],
    },
    // Ensure comments containing process.env.<VAR> are ignored and do not create duplicate reports
    {
      filename: "src/components/clientWithComment.tsx",
      code: `"use client";\n// process.env.SESSION_SECRET\nconst token = process.env.SESSION_SECRET;`,
      errors: [{ messageId: "noEnvSecretsClient" }],
    },
    // Template interpolation should be detected and reported
    {
      filename: "src/components/clientTemplateInterpolation.tsx",
      code:
        `"use client";\nconst token = ` +
        "`value: ${process.env.SESSION_SECRET}`" +
        `;`,
      errors: [{ messageId: "noEnvSecretsClient" }],
    },
    // JSX expression interpolation should be detected and reported
    {
      filename: "src/components/clientJsxExpr.tsx",
      code: `"use client";\nconst v = <div>{process.env.SESSION_SECRET}</div>;`,
      errors: [{ messageId: "noEnvSecretsClient" }],
    },
  ],
});

// --- require-csrf-check tests ---
runRuleTest("require-csrf-check", plugin.rules["require-csrf-check"], {
  valid: [
    {
      filename: "src/app/admin/actions.ts",
      code: `"use server"\nexport async function safeAction() { assertOrigin(); await prisma.user.create({}); }`,
    },
    {
      filename: "src/app/public/actions.ts",
      code: `"use server"\nexport async function submitSignIn() { await prisma.user.create({}); }`,
      options: [{ allowedUnprotectedFunctions: ["submitSignIn"] }],
    },
  ],
  invalid: [
    {
      filename: "src/app/admin/actions.ts",
      code: `"use server"\nexport async function unsafeAction() { await prisma.user.create({}); }`,
      errors: [{ messageId: "missingCsrf" }],
    },
    {
      filename: "src/app/admin/actions.ts",
      code: `"use server"\nexport const unsafeArrow = async () => { await prisma.user.create({}); }`,
      errors: [{ messageId: "missingCsrf" }],
    },
  ],
});

console.log("ESLint plugin rule tests ran successfully");
