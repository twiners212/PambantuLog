import { NextResponse } from "next/server";

/**
 * Legacy API Endpoint: /api/tickets
 *
 * Redirects permanently (HTTP 308) to /api/v1/tickets to ensure:
 * 1. Method and body preservation (POST / GET)
 * 2. Full rate limiting, Zod validation, idempotency, and RBAC execution
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  url.pathname = "/api/v1/tickets";
  return NextResponse.redirect(url, { status: 308 });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  url.pathname = "/api/v1/tickets";
  return NextResponse.redirect(url, { status: 308 });
}
