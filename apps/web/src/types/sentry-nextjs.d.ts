declare module "@sentry/nextjs" {
  export const withSentryConfig: <T>(config: T, options?: unknown) => T;
  export const captureRequestError: (...args: unknown[]) => void;
  export const captureException: (...args: unknown[]) => void;
  export const captureMessage: (...args: unknown[]) => void;
  export const init: (...args: unknown[]) => void;
  const Sentry: {
    withSentryConfig: typeof withSentryConfig;
    captureRequestError: typeof captureRequestError;
    captureException: typeof captureException;
    captureMessage: typeof captureMessage;
    init: typeof init;
  };
  export default Sentry;
}
