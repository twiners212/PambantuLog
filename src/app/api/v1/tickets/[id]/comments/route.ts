import { NextResponse } from "next/server";
import { db } from "@/db";
import { ticketComments } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { eq } from "drizzle-orm";

/**
 * GET /api/v1/tickets/:id/comments
 *
 * Returns all comments for a ticket, each with its author profile.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    const comments = await db.query.ticketComments.findMany({
      where: eq(ticketComments.ticketId, id),
      with: {
        user: {
          columns: { id: true, fullName: true, email: true, role: true },
        },
      },
      orderBy: (comments, { asc }) => [asc(comments.createdAt)],
    });

    return NextResponse.json({ success: true, data: comments });
  } catch (error) {
    console.error("[GET /api/v1/tickets/:id/comments]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/tickets/:id/comments
 *
 * Inserts a new comment on a ticket.
 * `userId` is derived from the active Supabase session — never from
 * the request body — to prevent impersonation.
 *
 * Body: { message, attachmentUrl? }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params;

    // ── 1. Authenticate ─────────────────────────────────────────────────
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
    const { message, attachmentUrl } = body;

    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, message: "Missing required field: message" },
        { status: 400 }
      );
    }

    // ── 3. Insert via Drizzle ───────────────────────────────────────────
    const [newComment] = await db
      .insert(ticketComments)
      .values({
        ticketId,
        userId: user.id,
        message: message.trim(),
        attachmentUrl: attachmentUrl ?? null,
      })
      .returning();

    return NextResponse.json(
      { success: true, data: newComment },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/v1/tickets/:id/comments]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
