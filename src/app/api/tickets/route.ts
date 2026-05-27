import { NextResponse } from "next/server";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * POST /api/tickets
 *
 * Creates a new ticket.
 * Uses the session-based Supabase client (anon key + cookies) to resolve
 * the authenticated user, so `createdById` is always trustworthy and
 * cannot be spoofed from the client.
 *
 * Body: { title, description, categoryId, priority? }
 */
export async function POST(request: Request) {
  try {
    // ── 1. Authenticate via session cookies ─────────────────────────────
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

    // ── 2. Parse & validate body ────────────────────────────────────────
    const body = await request.json();
    const { title, description, categoryId, priority } = body;

    if (!title || !description || !categoryId) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields: title, description, categoryId",
        },
        { status: 400 }
      );
    }

    // ── 3. Insert via Drizzle ───────────────────────────────────────────
    const [newTicket] = await db
      .insert(tickets)
      .values({
        title,
        description,
        categoryId,
        priority: priority ?? "medium",
        createdById: user.id, // secure — derived from the session, not the body
      })
      .returning();

    return NextResponse.json(
      { success: true, data: newTicket },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/tickets]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
