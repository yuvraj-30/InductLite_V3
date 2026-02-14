export function getTestRouteHeaders(
  existing?: Record<string, string>,
): Record<string, string> {
  const headers = { ...(existing ?? {}) };
  const secret = process.env.TEST_RUNNER_SECRET_KEY;
  if (secret) {
    headers["x-test-secret"] = secret;
  }
  return headers;
}
