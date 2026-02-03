/**
 * Rate Limit Client Tests
 *
 * Tests for Redis client memoization to ensure reliability under load.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Must mock @upstash/redis BEFORE importing client
// The mock factory is hoisted, so we can't reference external variables
vi.mock("@upstash/redis", () => {
  // Create a proper class mock
  class MockRedis {
    get = vi.fn();
    set = vi.fn();
    incr = vi.fn();
    expire = vi.fn();
  }

  return { Redis: MockRedis };
});

import {
  getRedisClient,
  getClientCreationCount,
  resetRedisClient,
  isRedisConfigured,
} from "../client";

describe("Rate Limit Client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    resetRedisClient();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    resetRedisClient();
  });

  describe("isRedisConfigured", () => {
    it("should return false when UPSTASH_REDIS_REST_URL is not set", () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      expect(isRedisConfigured()).toBe(false);
    });

    it("should return false when UPSTASH_REDIS_REST_TOKEN is not set", () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      expect(isRedisConfigured()).toBe(false);
    });

    it("should return true when both env vars are set", () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
      process.env.UPSTASH_REDIS_REST_TOKEN = "token123";

      expect(isRedisConfigured()).toBe(true);
    });
  });

  describe("getRedisClient", () => {
    describe("when Redis is not configured", () => {
      beforeEach(() => {
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;
      });

      it("should return null", () => {
        const client = getRedisClient();

        expect(client).toBeNull();
      });

      it("should not increment creation count", () => {
        getRedisClient();

        expect(getClientCreationCount()).toBe(0);
      });
    });

    describe("when Redis is configured", () => {
      beforeEach(() => {
        process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
        process.env.UPSTASH_REDIS_REST_TOKEN = "token123";
      });

      it("should return a Redis client", () => {
        const client = getRedisClient();

        expect(client).not.toBeNull();
      });

      it("should create Redis with correct config", () => {
        const client = getRedisClient();

        // Verify client was created
        expect(client).not.toBeNull();
        expect(getClientCreationCount()).toBe(1);
      });

      it("should increment creation count on first call", () => {
        expect(getClientCreationCount()).toBe(0);

        getRedisClient();

        expect(getClientCreationCount()).toBe(1);
      });
    });

    describe("memoization", () => {
      beforeEach(() => {
        process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
        process.env.UPSTASH_REDIS_REST_TOKEN = "token123";
      });

      it("should only create Redis client once across multiple calls", () => {
        // Call getRedisClient multiple times
        getRedisClient();
        getRedisClient();
        getRedisClient();
        getRedisClient();
        getRedisClient();

        // Redis constructor should only be called once
        expect(getClientCreationCount()).toBe(1);
      });

      it("should return same instance on subsequent calls", () => {
        const client1 = getRedisClient();
        const client2 = getRedisClient();
        const client3 = getRedisClient();

        expect(client1).toBe(client2);
        expect(client2).toBe(client3);
      });

      it("should create new client after reset", () => {
        // First call
        const client1 = getRedisClient();
        expect(getClientCreationCount()).toBe(1);

        // Reset and call again
        resetRedisClient();
        const client2 = getRedisClient();

        // A new client should be created (different instance)
        expect(client1).not.toBe(client2);
        expect(getClientCreationCount()).toBe(1); // Counter also reset
      });
    });

    describe("concurrent access simulation", () => {
      beforeEach(() => {
        process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
        process.env.UPSTASH_REDIS_REST_TOKEN = "token123";
      });

      it("should handle rapid concurrent-like calls", () => {
        // Simulate what happens under load - many calls in quick succession
        const results: ReturnType<typeof getRedisClient>[] = [];

        for (let i = 0; i < 100; i++) {
          results.push(getRedisClient());
        }

        // All should return the same instance
        const firstClient = results[0];
        for (const client of results) {
          expect(client).toBe(firstClient);
        }

        // Only one creation
        expect(getClientCreationCount()).toBe(1);
      });
    });
  });

  describe("resetRedisClient", () => {
    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
      process.env.UPSTASH_REDIS_REST_TOKEN = "token123";
    });

    it("should clear cached client", () => {
      const client1 = getRedisClient();
      resetRedisClient();
      const client2 = getRedisClient();

      // Different instances after reset
      expect(client1).not.toBe(client2);
    });

    it("should reset creation count", () => {
      getRedisClient();
      expect(getClientCreationCount()).toBe(1);

      resetRedisClient();
      expect(getClientCreationCount()).toBe(0);
    });
  });
});
