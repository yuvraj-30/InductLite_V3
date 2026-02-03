import { setIntervalAsync, clearIntervalAsync } from "set-interval-async/fixed";
import { processNextExportJob } from "./runner";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";

let handle: ReturnType<typeof setIntervalAsync> | null = null;

export function startExportScheduler(intervalMs: number = 10000) {
  const log = createRequestLogger(generateRequestId());

  if (handle) return handle; // already started

  handle = setIntervalAsync(async () => {
    try {
      const res = await processNextExportJob();
      if (res) {
        log.info({ res }, "Processed export job");
      }
    } catch (err) {
      log.error({ err: String(err) }, "Export scheduler error");
    }
  }, intervalMs);

  return handle;
}

export async function stopExportScheduler() {
  if (!handle) return;
  await clearIntervalAsync(handle);
  handle = null;
}
