import test from "node:test";
import assert from "node:assert/strict";
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

  assert.deepEqual(first, { allowed: true, remaining: 1, resetAt: 0 });
  assert.deepEqual(second, { allowed: true, remaining: 0, resetAt: 30 });
  assert.deepEqual(third, { allowed: false, remaining: 0, resetAt: 30 });
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

  assert.equal(afterRefill.allowed, true);
  assert.equal(afterRefill.remaining, 0);
  assert.equal(afterRefill.resetAt, 60);
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

  assert.equal(allowed.allowed, true);
  assert.equal(allowed.remaining, 0);
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.remaining, 0);
  assert.equal(rejected.resetAt, 1);
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

  assert.equal(rejected.allowed, false);
  assert.equal(allowedAgain.allowed, true);
  assert.equal(allowedAgain.remaining, 0);
  assert.equal(allowedAgain.resetAt, 2);
});
