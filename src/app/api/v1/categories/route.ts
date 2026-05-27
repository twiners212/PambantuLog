import { NextResponse } from "next/server";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { mockCategories } from "@/lib/mock-data";

const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * GET /api/v1/categories
 *
 * Returns all ticket categories. Requires authentication.
 */
export async function GET() {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ success: true, data: mockCategories });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const allCategories = await db.select().from(categories);

    return NextResponse.json({ success: true, data: allCategories });
  } catch (error) {
    console.error("[GET /api/v1/categories]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
