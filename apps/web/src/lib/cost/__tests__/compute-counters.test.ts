import { beforeEach, describe, expect, it } from "vitest";
import {
  getComputeCounterSnapshot,
  recordComputeInvocation,
  recordComputeRuntimeMinutes,
  resetComputeCounters,
} from "@/lib/cost/compute-counters";

describe("compute counters", () => {
  beforeEach(() => {
    resetComputeCounters();
  });

  it("records invocation counters by entrypoint", () => {
    recordComputeInvocation("server_action");
    recordComputeInvocation("server_action");
    recordComputeInvocation("webhook");

    const snapshot = getComputeCounterSnapshot();
    expect(snapshot.server_action.invocations).toBe(2);
    expect(snapshot.webhook.invocations).toBe(1);
    expect(snapshot.api_route.invocations).toBe(0);
  });

  it("records runtime minutes and ignores invalid values", () => {
    recordComputeRuntimeMinutes("scheduled_job", 1.5);
    recordComputeRuntimeMinutes("scheduled_job", -3);
    recordComputeRuntimeMinutes("scheduled_job", Number.NaN);

    const snapshot = getComputeCounterSnapshot();
    expect(snapshot.scheduled_job.runtimeMinutes).toBe(1.5);
  });
});
