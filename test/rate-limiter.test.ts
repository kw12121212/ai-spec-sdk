import { test, expect } from "bun:test";
import { RateLimiter } from "../src/rate-limiter.js";

test("RateLimiter consumes tokens until the bucket is exhausted", () => {
  let now = 0;
  const limiter = new RateLimiter({
    capacity: 2,
    refillPerMinute: 2,
    now: () => now,
  });

  const first = limiter.consume("key-1");
  const second = limiter.consume("key-1");
  const third = limiter.consume("key-1");

  expect(first).toEqual({ allowed: true, remaining: 1, resetAt: 0 });
  expect(second).toEqual({ allowed: true, remaining: 0, resetAt: 30 });
  expect(third).toEqual({ allowed: false, remaining: 0, resetAt: 30 });
});

test("RateLimiter refills tokens based on elapsed time", () => {
  let now = 0;
  const limiter = new RateLimiter({
    capacity: 2,
    refillPerMinute: 2,
    now: () => now,
  });

  limiter.consume("key-1");
  limiter.consume("key-1");

  now = 30_000;
  const afterRefill = limiter.consume("key-1");

  expect(afterRefill.allowed).toBe(true);
  expect(afterRefill.remaining).toBe(0);
  expect(afterRefill.resetAt).toBe(60);
});

test("RateLimiter rejects immediately after the last token is consumed", () => {
  let now = 0;
  const limiter = new RateLimiter({
    capacity: 1,
    refillPerMinute: 60,
    now: () => now,
  });

  const allowed = limiter.consume("key-1");
  const rejected = limiter.consume("key-1");

  expect(allowed.allowed).toBe(true);
  expect(allowed.remaining).toBe(0);
  expect(rejected.allowed).toBe(false);
  expect(rejected.remaining).toBe(0);
  expect(rejected.resetAt).toBe(1);
});

test("RateLimiter allows requests again after enough time passes", () => {
  let now = 0;
  const limiter = new RateLimiter({
    capacity: 1,
    refillPerMinute: 60,
    now: () => now,
  });

  limiter.consume("key-1");
  const rejected = limiter.consume("key-1");

  now = 1_000;
  const allowedAgain = limiter.consume("key-1");

  expect(rejected.allowed).toBe(false);
  expect(allowedAgain.allowed).toBe(true);
  expect(allowedAgain.remaining).toBe(0);
  expect(allowedAgain.resetAt).toBe(2);
});
