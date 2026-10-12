import { NextResponse } from "next/server";

/**
 * Rate Limiter Configuration Interface
 */
export interface RateLimitConfig {
  /** Maximum number of allowed requests in the time window */
  limit: number;
  /** Duration of window in milliseconds */
  windowMs: number;
  /** Descriptive prefix for the limiter namespace */
  prefix: string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // timestamp in epoch ms when the window resets
}

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Sliding Window Store (Development & Serverless Fallback)
// ─────────────────────────────────────────────────────────────────────────────

interface TokenBucketRecord {
  timestamps: number[];
}

const memoryStore = new Map<string, TokenBucketRecord>();

/**
 * Sliding Window In-Memory Rate Limiter
 */
function memorySlidingWindowLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const record = memoryStore.get(key) || { timestamps: [] };

  // Filter out timestamps older than the sliding window
  const validTimestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (validTimestamps.length >= config.limit) {
    const oldest = validTimestamps[0];
    const reset = oldest + config.windowMs;
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      reset,
    };
  }

  // Record this attempt
  validTimestamps.push(now);
  memoryStore.set(key, { timestamps: validTimestamps });

  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - validTimestamps.length,
    reset: now + config.windowMs,
  };
}

/**
 * Sliding Window In-Memory Rate Limiter - Peek Only (Does NOT record attempt)
 */
function memorySlidingWindowPeek(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const record = memoryStore.get(key) || { timestamps: [] };
  const validTimestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (validTimestamps.length >= config.limit) {
    const oldest = validTimestamps[0];
    const reset = oldest + config.windowMs;
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      reset,
    };
  }

  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - validTimestamps.length,
    reset: now + config.windowMs,
  };
}

/**
 * Periodically purge stale records to avoid memory leaks
 */
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryStore.entries()) {
      const active = record.timestamps.filter((ts) => ts > now - 15 * 60 * 1000);
      if (active.length === 0) {
        memoryStore.delete(key);
      } else {
        record.timestamps = active;
      }
    }
  }, 5 * 60 * 1000);
  timer.unref?.();
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiter Implementations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks rate limit for a given key and configuration.
 * Uses Upstash Redis if env credentials exist, otherwise falls back to memory.
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Check if Upstash Redis credentials are configured
  if (redisUrl && redisToken) {
    try {
      // Dynamic import to prevent bundler crashes if Upstash package is not installed
      const { Ratelimit } = await import("@upstash/ratelimit");
      const { Redis } = await import("@upstash/redis");

      const redis = new Redis({
        url: redisUrl,
        token: redisToken,
      });

      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(
          config.limit,
          `${Math.round(config.windowMs / 1000)} s` as `${number} s`
        ),
        prefix: config.prefix,
      });

      const result = await ratelimit.limit(identifier);

      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      };
    } catch {
      // Fallback silently to memory store if Upstash module fails or is missing
    }
  }

  // Fallback to In-Memory sliding window
  const fullKey = `${config.prefix}:${identifier}`;
  return memorySlidingWindowLimit(fullKey, config);
}

/**
 * Peeks rate limit status without consuming or recording an attempt.
 */
export async function peekRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const fullKey = `${config.prefix}:${identifier}`;
  return memorySlidingWindowPeek(fullKey, config);
}

// ─────────────────────────────────────────────────────────────────────────────
// Predefined Limiter Presets (Per Specification)
// ─────────────────────────────────────────────────────────────────────────────

export const LIMIT_CONFIGS = {
  /** Pembuatan tiket: Maksimal 5 tiket per 10 menit */
  TICKET_CREATE: {
    limit: 5,
    windowMs: 10 * 60 * 1000,
    prefix: "rl:ticket",
  },
  /** Komentar tiket: Maksimal 15 komentar per menit */
  COMMENT_CREATE: {
    limit: 15,
    windowMs: 60 * 1000,
    prefix: "rl:comment",
  },
  /** Percobaan login gagal: Maksimal 5 kali kegagalan per 15 menit */
  AUTH_LOGIN: {
    limit: 5,
    windowMs: 15 * 60 * 1000,
    prefix: "rl:login",
  },
  /** Ekspor laporan: Maksimal 1 kali per 2 menit */
  REPORT_EXPORT: {
    limit: 1,
    windowMs: 2 * 60 * 1000,
    prefix: "rl:export",
  },
} as const;

/**
 * Extracts Client IP address from request headers
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "127.0.0.1"
  );
}

/**
 * Creates standardized 429 Too Many Requests response with HTTP RateLimit headers
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  customMessage?: string
): NextResponse {
  const now = Date.now();
  const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - now) / 1000));

  const message =
    customMessage ||
    `Terlalu banyak permintaan (Rate limit terlampaui). Silakan coba lagi dalam ${retryAfterSeconds} detik.`;

  return NextResponse.json(
    {
      success: false,
      message,
      retryAfterSeconds,
      rateLimit: {
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.reset),
      },
    }
  );
}

/**
 * Reset rate limit counter (e.g. on successful login)
 */
export function resetMemoryRateLimit(identifier: string, prefix: string): void {
  const fullKey = `${prefix}:${identifier}`;
  memoryStore.delete(fullKey);
}
