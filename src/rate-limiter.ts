export const RATE_LIMIT_REQUESTS_PER_MINUTE = 120;

interface BucketState {
  tokens: number;
  lastRefillMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  capacity?: number;
  refillPerMinute?: number;
  now?: () => number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, BucketState>();
  private readonly capacity: number;
  private readonly refillPerMinute: number;
  private readonly now: () => number;

  constructor(options: RateLimiterOptions = {}) {
    this.capacity = options.capacity ?? RATE_LIMIT_REQUESTS_PER_MINUTE;
    this.refillPerMinute = options.refillPerMinute ?? this.capacity;
    this.now = options.now ?? (() => Date.now());
  }

  consume(keyId: string): RateLimitResult {
    const nowMs = this.now();
    const bucket = this.refillBucket(keyId, nowMs);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        resetAt: this.computeResetAt(bucket.tokens, nowMs),
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetAt: this.computeResetAt(bucket.tokens, nowMs),
    };
  }

  private refillBucket(keyId: string, nowMs: number): BucketState {
    const existing = this.buckets.get(keyId);
    if (!existing) {
      const initial: BucketState = {
        tokens: this.capacity,
        lastRefillMs: nowMs,
      };
      this.buckets.set(keyId, initial);
      return initial;
    }

    const elapsedMs = Math.max(0, nowMs - existing.lastRefillMs);
    if (elapsedMs > 0) {
      const refill = elapsedMs * (this.refillPerMinute / 60_000);
      existing.tokens = Math.min(this.capacity, existing.tokens + refill);
      existing.lastRefillMs = nowMs;
    }

    return existing;
  }

  private computeResetAt(tokens: number, nowMs: number): number {
    if (tokens >= 1) {
      return Math.floor(nowMs / 1000);
    }

    const refillPerMs = this.refillPerMinute / 60_000;
    const msUntilNextToken = Math.ceil((1 - tokens) / refillPerMs);
    return Math.ceil((nowMs + msUntilNextToken) / 1000);
  }
}
