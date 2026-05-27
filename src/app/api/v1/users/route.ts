import { NextResponse } from "next/server";
import { mockUsers } from "@/lib/mock-data";

const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get("role");

    if (!isSupabaseConfigured) {
      // Mock mode
      let filteredUsers = mockUsers;
      if (roleParam) {
        const roles = roleParam.split(",");
        filteredUsers = mockUsers.filter(u => roles.includes(u.role));
      }
      return NextResponse.json({ success: true, data: filteredUsers });
    }

    const { createSupabaseServerClient } = await import("@/lib/supabase-server");
    const { db } = await import("@/db");
    const { users } = await import("@/db/schema");
    const { inArray } = await import("drizzle-orm");

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Optionally check if the user is an admin here if you want to restrict listing users

    let result;
    if (roleParam) {
      const roles = roleParam.split(",") as ('admin' | 'agent' | 'karyawan')[];
      result = await db.select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        department: users.department
      })
      .from(users)
      .where(inArray(users.role, roles));
    } else {
      result = await db.select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        department: users.department
      }).from(users);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[GET /api/v1/users]", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
