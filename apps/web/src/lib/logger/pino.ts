/**
 * Structured Logging with Pino
 *
 * LOGGING STRATEGY:
 * - All logs include request_id for tracing
 * - All logs include company_id and user_id when available
 * - Structured JSON format for production (machine parseable)
 * - Pretty printed for development
 * - Log levels: trace, debug, info, warn, error, fatal
 *
 * Log contexts:
 * - request_id: Unique ID for each HTTP request
 * - company_id: Tenant identifier (null for public/unauthenticated)
 * - user_id: Authenticated user ID (null for anonymous)
 * - action: What operation is being performed
 * - entity_type: What type of entity is affected
 * - entity_id: Specific entity identifier
 */

import pino from "pino";

/**
 * Log context that can be attached to a logger
 */
export interface LogContext {
  request_id?: string;
  company_id?: string;
  user_id?: string;
  [key: string]: unknown;
}

/**
 * Base logger configuration
 */
const baseConfig: pino.LoggerOptions = {
  level:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === "production" ? "info" : "debug"),

  // Redact sensitive fields
  redact: {
    paths: [
      "password",
      "password_hash",
      "token",
      "authorization",
      "cookie",
      '["set-cookie"]',
      "*.password",
      "*.password_hash",
      "*.token",
      "headers.authorization",
      "headers.cookie",
    ],
    remove: true,
  },

  // Format timestamps as ISO strings
  timestamp: pino.stdTimeFunctions.isoTime,

  // Add service name
  base: {
    service: "inductlite",
    env: process.env.NODE_ENV || "development",
  },
};

/**
 * Development transport with pretty printing
 */
const devTransport: pino.TransportSingleOptions = {
  target: "pino-pretty",
  options: {
    colorize: true,
    translateTime: "SYS:standard",
    ignore: "pid,hostname",
    singleLine: false,
  },
};

/**
 * Create the base logger instance
 */
function createLogger(): pino.Logger {
  // In development, use pretty printing
  if (process.env.NODE_ENV !== "production") {
    return pino({
      ...baseConfig,
      transport: devTransport,
    });
  }

  // In production, use JSON output
  return pino(baseConfig);
}

/**
 * Root logger instance
 */
export const logger = createLogger();

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: LogContext): pino.Logger {
  return logger.child(context);
}

/**
 * Create a request-scoped logger
 */
export function createRequestLogger(
  requestId: string,
  additionalContext?: Partial<LogContext>,
): pino.Logger {
  return logger.child({
    request_id: requestId,
    ...additionalContext,
  });
}

/**
 * Create a tenant-scoped logger
 */
export function createTenantLogger(
  companyId: string,
  requestId?: string,
  userId?: string,
): pino.Logger {
  return logger.child({
    company_id: companyId,
    request_id: requestId,
    user_id: userId,
  });
}

/**
 * Log an operation with context
 */
export function logOperation(
  log: pino.Logger,
  level: pino.Level,
  action: string,
  details?: Record<string, unknown>,
): void {
  log[level]({ action, ...details });
}

/**
 * Log an error with context
 */
export function logError(
  log: pino.Logger,
  error: Error | unknown,
  action: string,
  details?: Record<string, unknown>,
): void {
  if (error instanceof Error) {
    log.error({
      action,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...details,
    });
  } else {
    log.error({
      action,
      error: String(error),
      ...details,
    });
  }
}

/**
 * Log a successful operation
 */
export function logSuccess(
  log: pino.Logger,
  action: string,
  details?: Record<string, unknown>,
): void {
  log.info({ action, status: "success", ...details });
}

/**
 * Log a failed operation
 */
export function logFailure(
  log: pino.Logger,
  action: string,
  reason: string,
  details?: Record<string, unknown>,
): void {
  log.warn({ action, status: "failed", reason, ...details });
}

/**
 * Log database query timing
 */
export function logQuery(
  log: pino.Logger,
  operation: string,
  entity: string,
  durationMs: number,
  details?: Record<string, unknown>,
): void {
  log.debug({
    action: "db.query",
    operation,
    entity,
    duration_ms: durationMs,
    ...details,
  });
}

/**
 * Log HTTP request/response
 */
export function logHttpRequest(
  log: pino.Logger,
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  details?: Record<string, unknown>,
): void {
  const level: pino.Level =
    statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

  log[level]({
    action: "http.request",
    method,
    path,
    status_code: statusCode,
    duration_ms: durationMs,
    ...details,
  });
}

/**
 * Log authentication event
 */
export function logAuthEvent(
  log: pino.Logger,
  event: "login" | "logout" | "login_failed" | "password_change" | "lockout",
  email: string,
  success: boolean,
  details?: Record<string, unknown>,
): void {
  const level: pino.Level = success ? "info" : "warn";

  log[level]({
    action: `auth.${event}`,
    email,
    success,
    ...details,
  });
}

export default logger;
