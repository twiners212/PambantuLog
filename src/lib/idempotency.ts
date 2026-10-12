import { NextResponse } from "next/server";

export interface IdempotencyRecord {
  status: "in-progress" | "completed";
  createdAt: number;
  expiresAt: number;
  responseBody?: unknown;
  statusCode?: number;
}

// In-Memory cache for idempotency tokens (TTL: 60s)
const idempotencyStore = new Map<string, IdempotencyRecord>();

/**
 * Periodically purge expired idempotency keys
 */
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of idempotencyStore.entries()) {
      if (now > record.expiresAt) {
        idempotencyStore.delete(key);
      }
    }
  }, 60 * 1000);
  timer.unref?.();
}

/**
 * Generates a unique client-side submission token (e.g. for form loads)
 */
export function generateIdempotencyToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Extracts the idempotency key from request header or body
 */
export function extractIdempotencyKey(
  request: Request,
  body?: Record<string, unknown>
): string | null {
  const headerKey = request.headers.get("x-idempotency-key");
  if (headerKey && headerKey.trim()) {
    return headerKey.trim();
  }

  if (body && typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()) {
    return body.idempotencyKey.trim();
  }

  return null;
}

export type IdempotencyCheckResult =
  | { allowed: true }
  | { allowed: false; response: NextResponse };

/**
 * Checks if the request is an in-flight duplicate or recently completed duplicate.
 * If not, locks the key for processing.
 */
export function checkIdempotency(
  key: string,
  ttlSeconds = 60
): IdempotencyCheckResult {
  const now = Date.now();
  const existing = idempotencyStore.get(key);

  if (existing) {
    if (now < existing.expiresAt) {
      if (existing.status === "in-progress") {
        return {
          allowed: false,
          response: NextResponse.json(
            {
              success: false,
              message:
                "Permintaan Anda sedang diproses. Mohon tidak menekan tombol submit secara berulang.",
              isDuplicateSubmission: true,
            },
            { status: 409 }
          ),
        };
      }

      // If already completed and has cached response, return idempotent success or conflict notice
      if (existing.status === "completed" && existing.responseBody) {
        return {
          allowed: false,
          response: NextResponse.json(
            {
              ...(existing.responseBody as object),
              _idempotentReplay: true,
            },
            { status: existing.statusCode || 200 }
          ),
        };
      }
    }
  }

  // Lock the key as in-progress
  idempotencyStore.set(key, {
    status: "in-progress",
    createdAt: now,
    expiresAt: now + ttlSeconds * 1000,
  });

  return { allowed: true };
}

/**
 * Finalizes the idempotency key when the operation successfully finishes
 */
export function resolveIdempotency(
  key: string,
  responseBody?: unknown,
  statusCode = 200,
  ttlSeconds = 60
): void {
  const now = Date.now();
  idempotencyStore.set(key, {
    status: "completed",
    createdAt: now,
    expiresAt: now + ttlSeconds * 1000,
    responseBody,
    statusCode,
  });
}

/**
 * Releases the idempotency lock if an unexpected error occurs so user can retry
 */
export function releaseIdempotency(key: string): void {
  idempotencyStore.delete(key);
}
