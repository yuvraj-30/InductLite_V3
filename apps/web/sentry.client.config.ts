import * as Sentry from "@sentry/nextjs";

const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1);

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
  enabled: Boolean(process.env.SENTRY_DSN),
});
