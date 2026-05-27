import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { eq } from "drizzle-orm";

/**
 * POST /api/admin/users
 *
 * Creates a new user in both Supabase Auth and our `users` table.
 * Restricted to callers with the "admin" role.
 *
 * Body: { email, password, fullName, role?, department? }
 */
export async function POST(request: Request) {
  try {
    // ── 1. Authenticate the caller ──────────────────────────────────────
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: caller },
    } = await supabase.auth.getUser();

    if (!caller) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // ── 2. Verify caller is an admin ────────────────────────────────────
    const [callerProfile] = await db
      .select()
      .from(users)
      .where(eq(users.id, caller.id))
      .limit(1);

    if (!callerProfile || callerProfile.role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Forbidden: Admin role required" },
        { status: 403 }
      );
    }

    // ── 3. Parse & validate body ────────────────────────────────────────
    const body = await request.json();
    const { email, password, fullName, role, department } = body;

    if (!email || !password || !fullName) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields: email, password, fullName",
        },
        { status: 400 }
      );
    }

    // ── 4. Create auth user via the service-role client ─────────────────
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // skip email verification for internal users
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          success: false,
          message: authError?.message ?? "Failed to create auth user",
        },
        { status: 422 }
      );
    }

    // ── 5. Insert profile row via Drizzle ───────────────────────────────
    const [newUser] = await db
      .insert(users)
      .values({
        id: authData.user.id, // sync with auth.users.id
        fullName,
        email,
        role: role ?? "karyawan",
        department: department ?? null,
      })
      .returning();

    return NextResponse.json({ success: true, data: newUser }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/users]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
