const { RuleTester } = require("eslint");
const plugin = require("../index.js");

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require("@typescript-eslint/parser"),
    ecmaVersion: 2020,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

function runRuleTest(name, rule, tests) {
  try {
    console.log(`Running rule tests for: ${name}`);
    ruleTester.run(name, rule, tests);
    console.log(`PASS ${name} tests passed`);
  } catch (err) {
    console.error(`FAIL ${name} tests FAILED`);
    throw err;
  }
}

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

runRuleTest(
  "no-publicdb-tenant-access",
  plugin.rules["no-publicdb-tenant-access"],
  {
    valid: [
      {
        filename: "src/lib/db/scoped.ts",
        code: `publicDb.signInRecord.findFirst({ where: { id: "rec_1" } })`,
      },
      {
        filename: "src/lib/db/scoped.ts",
        code: `async function run(tx) { return tx.inductionTemplate.findFirst({ where: { id: "tmpl_1" } }); }`,
      },
      {
        filename: "src/lib/repository/site.repository.ts",
        code: `publicDb.company.findFirst({ where: { slug: "alpha" } })`,
      },
    ],
    invalid: [
      {
        filename: "src/lib/repository/export.repository.ts",
        code: `publicDb.exportJob.findFirst({ where: { status: "QUEUED" } })`,
        errors: [{ messageId: "noPublicDbTenantAccess" }],
      },
      {
        filename: "src/lib/email/worker.ts",
        code: `publicDb.auditLog.create({ data: { action: "x" } })`,
        errors: [{ messageId: "noPublicDbTenantAccess" }],
      },
      {
        filename: "src/lib/email/worker.ts",
        code: `const dbAny = publicDb as unknown as { emailNotification: unknown }; dbAny.emailNotification.findMany({ where: { status: "PENDING" } });`,
        errors: [{ messageId: "noPublicDbTenantAccess" }],
      },
      {
        filename: "src/lib/repository/question.repository.ts",
        code: `publicDb.$transaction(async (tx) => tx.inductionQuestion.findFirst({ where: { id: "q_1" } }));`,
        errors: [{ messageId: "noPublicDbTenantAccess" }],
      },
      {
        filename: "src/lib/repository/question.repository.ts",
        code: `const rawTx = tx as typeof tx; rawTx.emailNotification.update({ where: { id: "n_1" } });`,
        errors: [{ messageId: "noPublicDbTenantAccess" }],
      },
    ],
  },
);

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
    {
      filename: "src/components/clientLiteralString.tsx",
      code: `"use client";\nconst token = 'process.env.SESSION_SECRET';`,
    },
    {
      filename: "src/components/clientTemplateLiteralPlain.tsx",
      code:
        `"use client";\nconst token = ` + "`process.env.SESSION_SECRET`" + `;`,
    },
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
    {
      filename: "src/components/clientWithComment.tsx",
      code: `"use client";\n// process.env.SESSION_SECRET\nconst token = process.env.SESSION_SECRET;`,
      errors: [{ messageId: "noEnvSecretsClient" }],
    },
    {
      filename: "src/components/clientTemplateInterpolation.tsx",
      code:
        `"use client";\nconst token = ` +
        "`value: ${process.env.SESSION_SECRET}`" +
        `;`,
      errors: [{ messageId: "noEnvSecretsClient" }],
    },
    {
      filename: "src/components/clientJsxExpr.tsx",
      code: `"use client";\nconst v = <div>{process.env.SESSION_SECRET}</div>;`,
      errors: [{ messageId: "noEnvSecretsClient" }],
    },
  ],
});

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
