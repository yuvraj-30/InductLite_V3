/**
 * Type declarations for @applitools/eyes-playwright
 * This module is optional and dynamically imported when available
 */
declare module "@applitools/eyes-playwright" {
  export class Eyes {
    constructor(runner?: unknown);
    check(name: string, target: unknown): Promise<void>;
    open(page: unknown, appName: string, testName: string): Promise<void>;
    close(throwEx?: boolean): Promise<unknown>;
    abortIfNotClosed(): Promise<void>;
    setConfiguration(configuration: unknown): void;
  }

  export class ClassicRunner {
    constructor();
  }

  export class VisualGridRunner {
    constructor(options?: { testConcurrency?: number });
  }

  export class Configuration {
    setBatch(batch: unknown): void;
    setApiKey(apiKey: string): void;
    setAppName(appName: string): void;
    addBrowser(width: number, height: number, browserType: unknown): void;
    setViewportSize(size: { width: number; height: number }): void;
  }

  export class BatchInfo {
    constructor(options?: { name?: string; id?: string });
  }

  export class Target {
    static window(): unknown;
    static region(selector: string): unknown;
  }

  export const BrowserType: {
    CHROME: unknown;
    FIREFOX: unknown;
    SAFARI: unknown;
    EDGE: unknown;
  };
}
