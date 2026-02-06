# Scaling Guide

## Knobs

- MAX_CONCURRENT_EXPORTS_GLOBAL
- MAX_CONCURRENT_EXPORTS_PER_COMPANY
- MAX_EXPORT_ROWS / MAX_EXPORT_BYTES
- Rate limit thresholds (public sign-in)

## Scale Steps

1. Increase worker concurrency cautiously.
2. Move rate limiting to Upstash (already supported).
3. Add read replicas only when needed.

## Backpressure

- Queue exports and throttle per company.
- Enforce off-peak exports when needed.
