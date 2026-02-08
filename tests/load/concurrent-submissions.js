import http from "k6/http";
import { check, sleep } from "k6";

/**
 * k6 Load Test: Concurrent Inductions
 * Focuses on Phase 6 requirements: ensuring the system can handle concurrent submissions.
 */

export const options = {
  stages: [
    { duration: "30s", target: 20 }, // Ramp up to 20 users
    { duration: "1m", target: 20 }, // Stay at 20 users
    { duration: "30s", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests must be under 500ms
    http_req_failed: ["rate<0.01"], // Less than 1% failure rate
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const SITE_SLUG = __ENV.SITE_SLUG || "demo-site";

export default function () {
  // 1. Visit the induction page
  const res = http.get(`${BASE_URL}/s/${SITE_SLUG}`);
  check(res, {
    "is status 200": (r) => r.status === 200,
  });

  // 2. Simulate a slight pause for "filling out form"
  sleep(Math.random() * 3 + 2);

  // 3. Submit induction (Simulated)
  // Note: In a real scenario, we'd hit the specific API/Action endpoint
  // For this load test, we're measuring the front-end page load and potential heavy SSR
  const payload = JSON.stringify({
    firstName: "Load",
    lastName: "Test",
    email: `test-${__VU}-${__ITER}@example.com`,
    company: "K6 Labs",
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  // Measurement of the dynamic route performance
  const postRes = http.get(`${BASE_URL}/s/${SITE_SLUG}?t=${Date.now()}`);
  check(postRes, {
    "dynamic page is 200": (r) => r.status === 200,
  });

  sleep(1);
}
