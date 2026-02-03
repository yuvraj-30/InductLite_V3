/**
 * Redis Client for Rate Limiting
 *
 * Provides a memoized Redis client singleton to ensure connection reuse
 * under high load. This prevents connection pool exhaustion and improves
 * rate limiting reliability.
 */

import { Redis } from "@upstash/redis";

/**
 * Cached Redis client instance.
 * Memoized to ensure only one connection is created per process.
 */
let cachedRedisClient: Redis | null = null;

/**
 * Track if Redis client has been created (for testing).
 */
let clientCreationCount = 0;

/**
 * Check if Upstash Redis is configured via environment variables.
 */
export function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

/**
 * Get the memoized Redis client instance.
 *
 * This function ensures only one Redis client is created per process,
 * improving reliability under load by reusing connections.
 *
 * @returns Redis client if configured, null otherwise
 */
export function getRedisClient(): Redis | null {
  // Return cached client if available
  if (cachedRedisClient) {
    return cachedRedisClient;
  }

  // Check if Redis is configured
  if (!isRedisConfigured()) {
    return null;
  }

  // Create and cache the client
  cachedRedisClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  clientCreationCount++;

  return cachedRedisClient;
}

/**
 * Get the number of times the Redis client has been created.
 * Exposed for testing to verify memoization works correctly.
 */
export function getClientCreationCount(): number {
  return clientCreationCount;
}

/**
 * Reset the cached Redis client.
 * Only for testing purposes - clears memoization.
 */
export function resetRedisClient(): void {
  cachedRedisClient = null;
  clientCreationCount = 0;
}
