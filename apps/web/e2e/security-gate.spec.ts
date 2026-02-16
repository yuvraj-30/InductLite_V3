import { test, expect, type APIRequestContext } from "@playwright/test";
import { getTestRouteHeaders } from "./utils/test-route-auth";

type RuntimePayload = {
  nodeEnv?: string | null;
  allowTestRunner?: boolean;
  ciRuntime?: boolean;
};

function createUserBody(email: string) {
  return {
    email,
    password: "Admin123!",
    role: "ADMIN",
    companySlug: `security-gate-${Date.now().toString(36)}`,
  };
}

async function getRuntimePayload(request: APIRequestContext) {
  const runtimeResponse = await request.get("/api/test/runtime", {
    headers: getTestRouteHeaders(),
  });

  if (!runtimeResponse.ok()) {
    return null;
  }

  return (await runtimeResponse.json()) as RuntimePayload;
}

test.describe("Test Route Security Gate", () => {
  test("create-user without x-test-secret is denied when gate is closed", async ({
    request,
  }) => {
    const runtime = await getRuntimePayload(request);
    const nodeEnv = String(runtime?.nodeEnv ?? "").toLowerCase();
    const allowTestRunner = Boolean(runtime?.allowTestRunner);

    const response = await request.post("/api/test/create-user", {
      headers: { "content-type": "application/json" },
      data: createUserBody(`no-secret-${Date.now()}@example.test`),
    });

    if (nodeEnv === "test" || (nodeEnv !== "production" && allowTestRunner)) {
      expect(response.status()).toBe(200);
      return;
    }

    expect([403, 404]).toContain(response.status());
  });

  test("create-user with x-test-secret follows environment gate policy", async ({
    request,
  }) => {
    const runtime = await getRuntimePayload(request);
    const nodeEnv = String(runtime?.nodeEnv ?? "").toLowerCase();
    const allowTestRunner = Boolean(runtime?.allowTestRunner);
    const ciRuntime = Boolean(runtime?.ciRuntime);

    const response = await request.post("/api/test/create-user", {
      headers: getTestRouteHeaders({ "content-type": "application/json" }),
      data: createUserBody(`with-secret-${Date.now()}@example.test`),
    });

    if (nodeEnv === "production") {
      if (allowTestRunner && ciRuntime) {
        expect(response.status()).toBe(200);
        return;
      }
      expect([403, 404]).toContain(response.status());
      return;
    }

    if (nodeEnv === "test" || allowTestRunner) {
      expect(response.status()).toBe(200);
      return;
    }

    expect([403, 404]).toContain(response.status());
  });
});
