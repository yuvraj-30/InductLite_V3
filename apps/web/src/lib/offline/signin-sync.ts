import {
  clearQueuedSignIn,
  loadQueuedSignIn,
} from "@/lib/offline/signin-queue";

export type QueuedSyncStatus = "missing" | "invalid" | "failed" | "synced";

interface SyncQueuedSignInOptions<T> {
  storageKey: string;
  submit: (payload: T) => Promise<boolean>;
}

export async function syncQueuedSignIn<T>(
  options: SyncQueuedSignInOptions<T>,
): Promise<QueuedSyncStatus> {
  const payload = loadQueuedSignIn<T>(options.storageKey);
  if (!payload) {
    return "missing";
  }

  try {
    const success = await options.submit(payload);
    if (!success) {
      return "failed";
    }

    clearQueuedSignIn(options.storageKey);
    return "synced";
  } catch {
    return "failed";
  }
}
