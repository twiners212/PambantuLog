import { NextResponse } from "next/server";
import { mockUsers } from "@/lib/mock-data";
import {
  checkRateLimit,
  peekRateLimit,
  LIMIT_CONFIGS,
  getClientIp,
  createRateLimitResponse,
  resetMemoryRateLimit,
} from "@/lib/rate-limit";

// ── Dev-mode flag ───────────────────────────────────────────────────────────
const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * POST /api/v1/auth/login
 *
 * Implements:
 * - Rate limiting: Max 5 failed attempts per 15 minutes per IP/email identifier.
 * - Reset on successful authentication.
 *
 * Body: { email, password }
 */
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email dan kata sandi wajib diisi" },
        { status: 400 }
      );
    }

    const clientIp = getClientIp(request);
    const normalizedEmail = email.toLowerCase().trim();
    const rateLimitIdentifier = `${clientIp}:${normalizedEmail}`;

    // ── Check if already locked out due to >= 5 failed attempts ─────────
    const preCheck = await peekRateLimit(rateLimitIdentifier, LIMIT_CONFIGS.AUTH_LOGIN);
    if (!preCheck.success) {
      return createRateLimitResponse(
        preCheck,
        "Terlalu banyak percobaan login yang gagal. Akun / IP Anda dibatasi selama 15 menit demi keamanan."
      );
    }

    // ── Mock mode (no Supabase env vars) ──────────────────────────────────
    if (!isSupabaseConfigured) {
      let user = mockUsers.find((u) => u.email === normalizedEmail);
      if (!user && normalizedEmail === "karyawan@company.com") {
        user = mockUsers.find((u) => u.role === "karyawan");
      }

      const isValidPassword =
        password === "password123" ||
        (user?.role === "admin" && password === "admin123") ||
        (user?.role === "karyawan" && password === "user123") ||
        (user?.role === "agent" && password === "support123");

      if (user && isValidPassword) {
        // Success: reset failed attempts
        const response = NextResponse.json({
          success: true,
          user,
          session: null,
        });
        const { setSessionCookie } = await import("@/lib/auth-session");
        return setSessionCookie(response, {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role as "admin" | "agent" | "karyawan",
          department: user.department,
        });
      }

      // Failed login: record attempt
      const failRecord = await checkRateLimit(rateLimitIdentifier, LIMIT_CONFIGS.AUTH_LOGIN);
      if (!failRecord.success) {
        return createRateLimitResponse(
          failRecord,
          "Terlalu banyak percobaan login yang gagal. Akun / IP Anda dibatasi selama 15 menit demi keamanan."
        );
      }

      return NextResponse.json(
        {
          success: false,
          message: `Kredensial tidak valid. Sisa percobaan: ${failRecord.remaining}`,
        },
        { status: 401 }
      );
    }

    // ── Real mode (Supabase configured) ───────────────────────────────────
    const { createSupabaseServerClient } = await import("@/lib/supabase-server");
    const { db } = await import("@/db");
    const { users } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

    if (authError || !authData.user) {
      const failRecord = await checkRateLimit(rateLimitIdentifier, LIMIT_CONFIGS.AUTH_LOGIN);
      if (!failRecord.success) {
        return createRateLimitResponse(
          failRecord,
          "Terlalu banyak percobaan login yang gagal. Akun / IP Anda dibatasi selama 15 menit demi keamanan."
        );
      }

      return NextResponse.json(
        {
          success: false,
          message:
            authError?.message ||
            `Kredensial tidak valid. Sisa percobaan: ${failRecord.remaining}`,
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
        { success: false, message: "Profil pengguna tidak ditemukan. Hubungi administrator." },
        { status: 404 }
      );
    }

    // Login succeeded: reset rate limit counter
    resetMemoryRateLimit(rateLimitIdentifier, LIMIT_CONFIGS.AUTH_LOGIN.prefix);

    const { setSessionCookie } = await import("@/lib/auth-session");
    const response = NextResponse.json({
      success: true,
      user: profile,
      session: {
        accessToken: authData.session?.access_token,
        refreshToken: authData.session?.refresh_token,
      },
    });

    return setSessionCookie(response, {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      department: profile.department,
    });
  } catch (error) {
    console.error("[POST /api/v1/auth/login]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan pada server" },
      { status: 500 }
    );
  }
}
