import { NextResponse } from "next/server";
import { mockUsers } from "@/lib/mock-data";

// ── Dev-mode flag ───────────────────────────────────────────────────────────
const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * POST /api/v1/auth/login
 *
 * When Supabase is configured → real auth via signInWithPassword.
 * When Supabase is NOT configured → falls back to mock users so you
 * can develop the UI without a backend.
 *
 * Body: { email, password }
 */
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Missing email or password" },
        { status: 400 }
      );
    }

    // ── Mock mode (no Supabase env vars) ──────────────────────────────────
    if (!isSupabaseConfigured) {
      const user = mockUsers.find((u) => u.email === email);

      if (user && password === "password123") {
        return NextResponse.json({
          success: true,
          user,
          session: null,
        });
      }

      return NextResponse.json(
        { success: false, message: "Invalid credentials" },
        { status: 401 }
      );
    }

    // ── Real mode (Supabase configured) ───────────────────────────────────
    const { createSupabaseServerClient } = await import(
      "@/lib/supabase-server"
    );
    const { db } = await import("@/db");
    const { users } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          success: false,
          message: authError?.message ?? "Invalid credentials",
        },
        { status: 401 }
      );
    }

    const [profile] = await db
      .select()
      .from(users)
      .where(eq(users.id, authData.user.id))
      .limit(1);

    if (!profile) {
      return NextResponse.json(
        { success: false, message: "User profile not found. Contact admin." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: profile,
      session: {
        accessToken: authData.session?.access_token,
        refreshToken: authData.session?.refresh_token,
      },
    });
  } catch (error) {
    console.error("[POST /api/v1/auth/login]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
