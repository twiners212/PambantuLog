import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/ping
 *
 * Keep-Alive ping endpoint for Supabase to prevent project pausing/freezing
 * due to the 7-day free tier inactivity policy.
 *
 * It sends lightweight requests to both:
 * 1. PostgreSQL pooler via Drizzle (`SELECT 1;`)
 * 2. Supabase PostgREST API
 *
 * Can be called by:
 * - Vercel Cron Jobs (daily)
 * - External uptime monitors (UptimeRobot, cron-job.org)
 * - GitHub Actions workflow
 */
export async function GET() {
  const startTime = Date.now();
  const isSupabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isDbConfigured = !!process.env.DATABASE_URL;

  const checks: Record<string, string> = {};

  try {
    if (!isSupabaseConfigured && !isDbConfigured) {
      return NextResponse.json({
        success: true,
        mode: "mock",
        message:
          "PambantuLog Keep-Alive Ping OK (Mock Mode - Supabase credentials not configured)",
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
      });
    }

    // 1. Ping PostgreSQL connection via Drizzle ORM
    if (isDbConfigured) {
      try {
        const { db } = await import("@/db");
        const { sql } = await import("drizzle-orm");
        await db.execute(sql`SELECT 1 as ping;`);
        checks.database = "connected";
      } catch (dbErr) {
        console.error("[Ping] Database error:", dbErr);
        checks.database = `error: ${
          dbErr instanceof Error ? dbErr.message : "Connection failed"
        }`;
      }
    } else {
      checks.database = "not_configured";
    }

    // 2. Ping Supabase REST API (PostgREST)
    if (isSupabaseConfigured) {
      try {
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/categories?select=id&limit=1`;
        const res = await fetch(url, {
          method: "GET",
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
          },
          cache: "no-store",
        });

        if (res.ok) {
          checks.supabaseRest = `connected (HTTP ${res.status})`;
        } else {
          checks.supabaseRest = `warning (HTTP ${res.status})`;
        }
      } catch (restErr) {
        console.error("[Ping] REST error:", restErr);
        checks.supabaseRest = `error: ${
          restErr instanceof Error ? restErr.message : "Fetch failed"
        }`;
      }
    } else {
      checks.supabaseRest = "not_configured";
    }

    const latencyMs = Date.now() - startTime;
    const hasError = Object.values(checks).some((v) => v.startsWith("error:"));

    return NextResponse.json(
      {
        success: !hasError,
        message: hasError
          ? "Keep-alive ping completed with warnings/errors"
          : "Supabase keep-alive ping successful (inactivity timer reset)",
        timestamp: new Date().toISOString(),
        latencyMs,
        checks,
      },
      { status: hasError ? 503 : 200 }
    );
  } catch (error) {
    console.error("[Ping Exception]", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal keep-alive ping error",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

export { GET as POST, GET as HEAD };
