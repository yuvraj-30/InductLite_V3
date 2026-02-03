#!/usr/bin/env node
/* eslint-disable no-console */
const { Redis } = require("@upstash/redis");

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const clientKey = process.argv[2]; // optional, e.g., 'ua:e2e'

if (!url || !token) {
  console.error(
    "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN required in env",
  );
  process.exit(1);
}

async function scanAndDelete(redis, pattern) {
  try {
    if (typeof redis.scanIterator === "function") {
      for await (const key of redis.scanIterator({ MATCH: pattern })) {
        console.log("Deleting:", key);
        await redis.del(key);
      }
    } else {
      // Fallback scan loop
      let cursor = 0;
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100,
        );
        cursor = Number(nextCursor);
        for (const key of keys) {
          console.log("Deleting:", key);
          await redis.del(key);
        }
      } while (cursor !== 0);
    }
  } catch (err) {
    console.warn("Scan/delete failed for pattern", pattern, String(err));
  }
}

(async () => {
  const redis = new Redis({ url, token });
  try {
    if (clientKey) {
      // Delete keys containing clientKey and our prefix
      const patterns = [
        `inductlite:*${clientKey}*`,
        `inductlite:*${clientKey}*:*`,
      ];
      for (const p of patterns) await scanAndDelete(redis, p);
    } else {
      // Conservative default: only delete keys with the inductlite:ratelimit and related prefixes
      const patterns = [
        "inductlite:ratelimit*",
        "inductlite:login-ratelimit*",
        "inductlite:signin-ratelimit*",
      ];
      for (const p of patterns) await scanAndDelete(redis, p);
    }
  } finally {
    // Close client if possible
    try {
      await redis.disconnect?.();
    } catch (_e) {
          // noop: best-effort disconnect
        }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
