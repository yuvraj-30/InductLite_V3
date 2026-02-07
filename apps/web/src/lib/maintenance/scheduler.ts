import { setIntervalAsync, clearIntervalAsync } from "set-interval-async/fixed";
import { runRetentionTasks } from "./retention";
import { processEmailQueue } from "@/lib/email/worker";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";

let handle: ReturnType<typeof setIntervalAsync> | null = null;

export function startMaintenanceScheduler(
  intervalMs: number = 24 * 60 * 60 * 1000,
) {
  const log = createRequestLogger(generateRequestId());

  if (handle) return handle;

  handle = setIntervalAsync(async () => {
    try {
      await runRetentionTasks();
      await processEmailQueue();
      log.info({}, "Maintenance and email queue tasks completed");
    } catch (err) {
      log.error({ err: String(err) }, "Maintenance scheduler error");
    }
  }, intervalMs);

  return handle;
}

export async function stopMaintenanceScheduler() {
  if (!handle) return;
  await clearIntervalAsync(handle);
  handle = null;
}
