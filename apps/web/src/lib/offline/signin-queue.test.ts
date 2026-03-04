import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearQueuedSignIn,
  hasQueuedSignIn,
  loadQueuedSignIn,
  saveQueuedSignIn,
} from "@/lib/offline/signin-queue";

interface LocalStorageMock {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
}

function createLocalStorageMock(): {
  localStorage: LocalStorageMock;
  store: Map<string, string>;
} {
  const store = new Map<string, string>();
  const localStorage: LocalStorageMock = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
  };

  return { localStorage, store };
}

describe("signin queue local storage helpers", () => {
  beforeEach(() => {
    const { localStorage } = createLocalStorageMock();
    vi.stubGlobal("window", { localStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redacts employerName before persisting queued payloads", () => {
    const { localStorage, store } = createLocalStorageMock();
    vi.stubGlobal("window", { localStorage });

    saveQueuedSignIn("queue-key", {
      visitorName: "Jane",
      employerName: "Sensitive Employer",
      nested: {
        employerName: "Nested Employer",
      },
      keep: true,
    });

    const raw = store.get("queue-key");
    expect(raw).toBeTruthy();
    expect(raw).not.toContain("Sensitive Employer");
    expect(raw).not.toContain("Nested Employer");

    const parsed = JSON.parse(raw as string) as Record<string, unknown>;
    expect(parsed).toEqual({
      visitorName: "Jane",
      nested: {},
      keep: true,
    });
  });

  it("loads and clears queued payloads", () => {
    const { localStorage } = createLocalStorageMock();
    vi.stubGlobal("window", { localStorage });

    saveQueuedSignIn("queue-key", { visitorName: "Jane" });
    expect(hasQueuedSignIn("queue-key")).toBe(true);
    expect(loadQueuedSignIn<{ visitorName: string }>("queue-key")).toEqual({
      visitorName: "Jane",
    });

    clearQueuedSignIn("queue-key");
    expect(hasQueuedSignIn("queue-key")).toBe(false);
  });

  it("drops invalid queued JSON", () => {
    const { localStorage, store } = createLocalStorageMock();
    vi.stubGlobal("window", { localStorage });

    store.set("queue-key", "{invalid json");
    const loaded = loadQueuedSignIn("queue-key");

    expect(loaded).toBeNull();
    expect(localStorage.removeItem).toHaveBeenCalledWith("queue-key");
  });
});
