/**
 * ESLint Security Guardrails Plugin
 *
 * Custom rules to enforce security invariants at build time:
 * - no-raw-sql: Prevent raw SQL injection via $executeRaw/$queryRaw
 * - require-company-id: Ensure tenant scoping in repository methods
 * - no-env-secrets: Prevent accidental secret exposure in client code
 */

"use strict";

function containsCompanyId(node) {
  if (!node || typeof node !== "object") return false;

  if (node.type === "Property") {
    if (
      node.key &&
      node.key.type === "Identifier" &&
      node.key.name === "company_id"
    ) {
      return true;
    }
    return containsCompanyId(node.value);
  }

  if (node.type === "ObjectExpression") {
    return node.properties.some((p) => containsCompanyId(p));
  }

  if (node.type === "ArrayExpression") {
    return node.elements.some((e) => containsCompanyId(e));
  }

  return false;
}

module.exports = {
  rules: {
    /**
     * Disallow raw SQL methods that bypass Prisma's query builder
     *
     * WHY: $executeRaw, $queryRaw, and $executeRawUnsafe can lead to SQL injection
     * if user input is interpolated. Tagged templates are safer but still risky.
     *
     * USE INSTEAD: Prisma's type-safe query builder methods
     */
    "no-raw-sql": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Disallow raw SQL execution methods that bypass Prisma's query builder",
          category: "Security",
          recommended: true,
        },
        messages: {
          noRawSql:
            "Avoid using {{ method }}(). Use Prisma's query builder instead. If raw SQL is absolutely necessary, get security review and use tagged templates.",
        },
        schema: [],
      },
      create(context) {
        const bannedMethods = [
          "$executeRaw",
          "$queryRaw",
          "$executeRawUnsafe",
          "$queryRawUnsafe",
        ];

        return {
          MemberExpression(node) {
            if (
              node.property &&
              node.property.type === "Identifier" &&
              bannedMethods.includes(node.property.name)
            ) {
              context.report({
                node,
                messageId: "noRawSql",
                data: { method: node.property.name },
              });
            }
          },
        };
      },
    },

    /**
     * Require company_id in repository WHERE clauses
     *
     * WHY: Every tenant-scoped query must include company_id to prevent IDOR
     *
     * This is a heuristic rule that flags suspicious patterns.
     * Configure tenantTables option to add new tables as the schema grows.
     */
    "require-company-id": {
      meta: {
        type: "suggestion",
        docs: {
          description:
            "Suggest including company_id in repository queries for tenant isolation",
          category: "Security",
          recommended: true,
        },
        messages: {
          missingCompanyId:
            "Repository method '{{ tableName }}' appears to query without company_id. Ensure tenant scoping is applied.",
        },
        schema: [
          {
            type: "object",
            properties: {
              tenantTables: {
                type: "array",
                items: { type: "string" },
                description:
                  "List of table names that require company_id scoping",
              },
            },
            additionalProperties: false,
          },
        ],
      },
      create(context) {
        const options = context.options[0] || {};
        // Default tenant tables - add new tables here or via config
        const defaultTenantTables = [
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
        ];
        const tenantTables = options.tenantTables || defaultTenantTables;

        // Track if we're in a repository file
        const filename = context.getFilename();
        const isRepositoryFile = filename.includes("repository");

        if (!isRepositoryFile) {
          return {};
        }

        return {
          // Look for findMany/findFirst/findUnique without company_id
          CallExpression(node) {
            try {
              // Debug: inspect callee and arguments when running tests
              // Uncomment below for deep debugging during test development
              // console.log('CallExpression callee type:', node.callee.type);
              // console.log('CallExpression callee prop:', node.callee.property && node.callee.property.name);

              if (
                node.callee.type === "MemberExpression" &&
                node.callee.property &&
                node.callee.property.type === "Identifier" &&
                [
                  "findMany",
                  "findFirst",
                  "findUnique",
                  "updateMany",
                  "deleteMany",
                ].includes(node.callee.property.name)
              ) {
                // Check if the call has a where clause with company_id
                const args = node.arguments;
                if (args.length > 0 && args[0].type === "ObjectExpression") {
                  const whereProperty = args[0].properties.find(
                    (p) =>
                      p.type === "Property" &&
                      p.key.type === "Identifier" &&
                      p.key.name === "where",
                  );

                  if (
                    whereProperty &&
                    whereProperty.value.type === "ObjectExpression"
                  ) {
                    const hasCompanyId = containsCompanyId(whereProperty.value);

                    // Only report if we're in a clearly tenant-scoped context
                    const calleeName = getCalleeName(node.callee);
                    const matchedTable = tenantTables.find((t) =>
                      calleeName.toLowerCase().includes(t.toLowerCase()),
                    );

                    if (!hasCompanyId && matchedTable) {
                      context.report({
                        node,
                        messageId: "missingCompanyId",
                        data: { tableName: matchedTable },
                      });
                    }
                  }
                }
              }
            } catch (err) {
              // Avoid crashing lint if something unexpected appears in AST
              // eslint-disable-next-line no-console
              console.error(
                "require-company-id rule error:",
                err && err.message,
              );
            }
          },
        };
      },
    },
    /**
     * Prevent environment variable access in client components
     *
     * WHY: Server-side secrets should never be accessed from client components
     * as they would be exposed in the browser.
     */
    "no-env-secrets-client": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Prevent accessing secret environment variables in client components",
          category: "Security",
          recommended: true,
        },
        messages: {
          noEnvSecretsClient:
            "Do not access {{ envVar }} in client components. This may expose secrets to the browser.",
        },
        schema: [],
      },
      create(context) {
        const filename = context.getFilename();

        // Check if this is a client component
        const sourceCode = context.getSourceCode();
        const firstToken = sourceCode.getFirstToken(sourceCode.ast);
        const hasDirective =
          sourceCode.ast &&
          Array.isArray(sourceCode.ast.body) &&
          sourceCode.ast.body.length > 0 &&
          sourceCode.ast.body[0].directive === "use client";

        const isClientComponent =
          hasDirective ||
          (firstToken &&
            (firstToken.type === "String" || firstToken.type === "Literal") &&
            firstToken.value === "use client");

        if (!isClientComponent) {
          return {};
        }

        // List of secret env vars that should never be in client code
        const secretPatterns = [
          "DATABASE_URL",
          "SESSION_SECRET",
          "SIGN_OUT_TOKEN_SECRET",
          "API_KEY",
          "PRIVATE_KEY",
          "SECRET",
          "PASSWORD",
          "CREDENTIAL",
        ];

        // Track reported positions to avoid duplicate reports (MemberExpression + fallback)
        const reportedPositions = new Set();

        return {
          MemberExpression(node) {
            if (
              node.object &&
              node.object.type === "MemberExpression" &&
              node.object.object &&
              node.object.object.type === "Identifier" &&
              node.object.object.name === "process" &&
              node.object.property &&
              node.object.property.type === "Identifier" &&
              node.object.property.name === "env" &&
              node.property &&
              node.property.type === "Identifier"
            ) {
              const envVarName = node.property.name;

              // NEXT_PUBLIC_* variables are intentionally exposed to client
              // They go through Next.js build-time replacement and are safe
              if (envVarName.startsWith("NEXT_PUBLIC_")) {
                return;
              }

              const isSecret = secretPatterns.some((pattern) =>
                envVarName.toUpperCase().includes(pattern),
              );

              if (isSecret) {
                // record position to avoid fallback duplicate
                if (node.range && node.range.length > 0) {
                  reportedPositions.add(node.range[0]);
                }
                context.report({
                  node,
                  messageId: "noEnvSecretsClient",
                  data: { envVar: envVarName },
                });
              }
            }
          },

          // Fallback: if MemberExpression visitor was not hit for any reason,
          // scan source text for 'process.env.<SECRET>' and report locations directly.
          "Program:exit"() {
            try {
              const text = sourceCode.getText();
              const re = /process\.env\.([A-Za-z0-9_]+)/gi;
              let match;
              while ((match = re.exec(text)) !== null) {
                const varName = match[1];
                const startIndex = match.index;
                // Avoid duplicates when MemberExpression already reported
                if (reportedPositions.has(startIndex)) continue;
                const endIndex = re.lastIndex;
                const startLoc = sourceCode.getLocFromIndex(startIndex);
                const endLoc = sourceCode.getLocFromIndex(endIndex);

                // Skip matches inside comments
                const comments = sourceCode.getAllComments();
                const inComment = comments.some(
                  (c) => startIndex >= c.range[0] && startIndex < c.range[1],
                );
                if (inComment) continue;

                // Skip matches that are inside string/template literals or JSX text
                const enclosingNode =
                  sourceCode.getNodeByRangeIndex(startIndex);
                if (enclosingNode) {
                  // TemplateElement covers the static parts of template literals (``) — skip these
                  if (
                    enclosingNode.type === "Literal" ||
                    enclosingNode.type === "TemplateElement" ||
                    enclosingNode.type === "JSXText"
                  ) {
                    continue;
                  }
                }

                const isSecret = secretPatterns.some((pattern) =>
                  varName.toUpperCase().includes(pattern),
                );
                if (isSecret) {
                  context.report({
                    loc: { start: startLoc, end: endLoc },
                    messageId: "noEnvSecretsClient",
                    data: { envVar: varName },
                  });
                }
              }
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error(
                "no-env-secrets-client Program:exit error:",
                err && err.message,
              );
            }
          },
        };
      },
    },

    /**
     * Enforce assertOrigin() or requireAuthenticatedContext() in server actions
     *
     * WHY: All mutating server actions must validate Origin header for CSRF defense.
     *
     * STRATEGY: Instead of guessing by function name, we:
     * 1. Detect exported async functions in 'use server' files
     * 2. Check if they call assertOrigin(), requireAuthenticatedContext(), or are allowlisted
     * 3. Flag functions with detected mutations (create/update/delete) without protection
     */
    "require-csrf-check": {
      meta: {
        type: "suggestion",
        docs: {
          description: "Require CSRF or auth check in server actions",
          category: "Security",
          recommended: true,
        },
        messages: {
          missingCsrf:
            "Server action '{{ funcName }}' performs mutations without assertOrigin() or requireAuthenticatedContext(). Add CSRF protection or auth context.",
        },
        schema: [
          {
            type: "object",
            properties: {
              allowedUnprotectedFunctions: {
                type: "array",
                items: { type: "string" },
                description:
                  "Functions intentionally unprotected (e.g., public sign-in)",
              },
              mutationPatterns: {
                type: "array",
                items: { type: "string" },
                description: "Method name patterns that indicate mutations",
              },
            },
            additionalProperties: false,
          },
        ],
      },
      create(context) {
        const options = context.options[0] || {};
        const allowedUnprotected = new Set(
          options.allowedUnprotectedFunctions || [],
        );
        const mutationPatterns = options.mutationPatterns || [
          "create",
          "update",
          "delete",
          "upsert",
          "remove",
          "save",
          "insert",
          "destroy",
          "submit",
        ];
        const mutationRegex = new RegExp(
          `(${mutationPatterns.join("|")})`,
          "i",
        );

        const filename = context.getFilename();
        const isActionsFile =
          filename.includes("actions.ts") || filename.includes("actions.tsx");

        if (!isActionsFile) {
          return {};
        }

        // Check for 'use server' directive
        const sourceCode = context.getSourceCode();
        const sourceText = sourceCode.getText();
        const hasUseServer =
          sourceText.startsWith('"use server"') ||
          sourceText.startsWith("'use server'");

        if (!hasUseServer) {
          return {};
        }

        // Track protection calls and mutations per function
        const functionInfo = new Map(); // funcName -> { hasProtection, hasMutation, node }

        /**
         * Find the enclosing function name for a node
         */
        function getEnclosingFunctionName(node) {
          let current = node.parent;
          while (current) {
            if (current.type === "FunctionDeclaration" && current.id) {
              return current.id.name;
            }
            if (
              current.type === "VariableDeclarator" &&
              current.id &&
              current.id.type === "Identifier" &&
              (current.init?.type === "ArrowFunctionExpression" ||
                current.init?.type === "FunctionExpression")
            ) {
              return current.id.name;
            }
            current = current.parent;
          }
          return null;
        }

        /**
         * Check if a call expression is a protection function
         */
        function isProtectionCall(node) {
          if (node.callee.type === "Identifier") {
            const protectionFunctions = [
              "assertOrigin",
              "validateOrigin",
              "requireAuthenticatedContext",
              "requireAuth",
              "requireSession",
            ];
            return protectionFunctions.includes(node.callee.name);
          }
          return false;
        }

        /**
         * Check if a call expression is a mutation
         */
        function isMutationCall(node) {
          if (node.callee.type === "MemberExpression" && node.callee.property) {
            const methodName = node.callee.property.name || "";
            return mutationRegex.test(methodName);
          }
          if (node.callee.type === "Identifier") {
            return mutationRegex.test(node.callee.name);
          }
          return false;
        }

        return {
          // Track exported async function declarations and exported async variables
          ExportNamedDeclaration(node) {
            if (
              node.declaration?.type === "FunctionDeclaration" &&
              node.declaration.async &&
              node.declaration.id
            ) {
              const funcName = node.declaration.id.name;
              if (!functionInfo.has(funcName)) {
                functionInfo.set(funcName, {
                  hasProtection: false,
                  hasMutation: false,
                  node: node.declaration,
                });
              }
            }

            // Handle exported async arrow functions: export const foo = async () => {}
            if (node.declaration?.type === "VariableDeclaration") {
              for (const decl of node.declaration.declarations) {
                if (
                  decl.id &&
                  decl.id.type === "Identifier" &&
                  decl.init &&
                  (decl.init.type === "ArrowFunctionExpression" ||
                    decl.init.type === "FunctionExpression") &&
                  decl.init.async
                ) {
                  const funcName = decl.id.name;
                  if (!functionInfo.has(funcName)) {
                    functionInfo.set(funcName, {
                      hasProtection: false,
                      hasMutation: false,
                      node: decl,
                    });
                  }
                }
              }
            }
          },

          // Track all call expressions
          CallExpression(node) {
            const funcName = getEnclosingFunctionName(node);
            if (!funcName || !functionInfo.has(funcName)) {
              return;
            }

            const info = functionInfo.get(funcName);

            if (isProtectionCall(node)) {
              info.hasProtection = true;
            }

            if (isMutationCall(node)) {
              info.hasMutation = true;
            }
          },

          // Final validation
          "Program:exit"() {
            for (const [funcName, info] of functionInfo) {
              // Skip explicitly allowed functions
              if (allowedUnprotected.has(funcName)) {
                continue;
              }

              // If function has mutations without protection, report
              if (info.hasMutation && !info.hasProtection) {
                context.report({
                  node: info.node,
                  messageId: "missingCsrf",
                  data: { funcName },
                });
              }
            }
          },
        };
      },
    },
  },
};

/**
 * Helper to get the full callee name from a MemberExpression
 */
function getCalleeName(callee) {
  if (callee.type === "MemberExpression") {
    const objectPart =
      callee.object.type === "Identifier"
        ? callee.object.name
        : getCalleeName(callee.object);
    const propertyPart =
      callee.property.type === "Identifier" ? callee.property.name : "";
    return `${objectPart}.${propertyPart}`;
  }
  return "";
}
