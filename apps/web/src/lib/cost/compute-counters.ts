export type ComputeEntrypoint =
  | "server_action"
  | "route_handler"
  | "api_route"
  | "middleware"
  | "webhook"
  | "scheduled_job";

type Snapshot = Record<
  ComputeEntrypoint,
  {
    invocations: number;
    runtimeMinutes: number;
  }
>;

const ENTRYPOINTS: ComputeEntrypoint[] = [
  "server_action",
  "route_handler",
  "api_route",
  "middleware",
  "webhook",
  "scheduled_job",
];

const invocations = new Map<ComputeEntrypoint, number>();
const runtimeMinutes = new Map<ComputeEntrypoint, number>();

for (const entrypoint of ENTRYPOINTS) {
  invocations.set(entrypoint, 0);
  runtimeMinutes.set(entrypoint, 0);
}

export function recordComputeInvocation(entrypoint: ComputeEntrypoint): void {
  invocations.set(entrypoint, (invocations.get(entrypoint) ?? 0) + 1);
}

export function recordComputeRuntimeMinutes(
  entrypoint: ComputeEntrypoint,
  minutes: number,
): void {
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
  runtimeMinutes.set(
    entrypoint,
    (runtimeMinutes.get(entrypoint) ?? 0) + safeMinutes,
  );
}

export function getComputeCounterSnapshot(): Snapshot {
  const snapshot = {} as Snapshot;
  for (const entrypoint of ENTRYPOINTS) {
    snapshot[entrypoint] = {
      invocations: invocations.get(entrypoint) ?? 0,
      runtimeMinutes: runtimeMinutes.get(entrypoint) ?? 0,
    };
  }
  return snapshot;
}

export function resetComputeCounters(): void {
  for (const entrypoint of ENTRYPOINTS) {
    invocations.set(entrypoint, 0);
    runtimeMinutes.set(entrypoint, 0);
  }
}
