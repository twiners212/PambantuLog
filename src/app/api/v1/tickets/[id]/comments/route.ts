import { NextResponse } from "next/server";
import { mockTickets, mockComments, mockUsers } from "@/lib/mock-data";
import { createCommentSchema } from "@/lib/validations/ticket";
import { validateRequestBody } from "@/lib/validations/api-validator";
import {
  checkRateLimit,
  LIMIT_CONFIGS,
  createRateLimitResponse,
} from "@/lib/rate-limit";
import { getServerSession } from "@/lib/auth-session";

const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

    // ── 1. Authenticate ─────────────────────────────────────────────────
    let currentUserId: string | null = null;
    const session = await getServerSession();
    if (session) {
      currentUserId = session.id;
    } else if (isSupabaseConfigured) {
      const { createSupabaseServerClient } = await import("@/lib/supabase-server");
      const supabase = await createSupabaseServerClient();
      if (supabase) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) currentUserId = user.id;
      }
    }

    if (!currentUserId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!isSupabaseConfigured) {
      // Mock mode: Filter mockComments for this ticket
      const ticketCommentsData = mockComments
        .filter((c) => c.ticketId === id)
        .map((c) => {
          const user = mockUsers.find((u) => u.id === c.authorId);
          return {
            id: c.id,
            ticketId: c.ticketId,
            userId: c.authorId,
            message: c.content,
            attachmentUrl: null,
            createdAt: c.createdAt,
            user: user
              ? { id: user.id, fullName: user.fullName, email: user.email, role: user.role }
              : null,
          };
        });

      return NextResponse.json({ success: true, data: ticketCommentsData });
    }

    // Real mode: Drizzle query
    const { db } = await import("@/db");
    const { ticketComments } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

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
 * Rules:
 * - Rate limit: max 15 comments per minute per user ID.
 * - Validation: message max 1000 characters, min 1 character.
 * - Guard: rejects comment on closed ticket (400 Bad Request).
 * - Guard: karyawan can only comment on their own ticket (403 Forbidden).
 *
 * Body: { message: string, attachmentUrl?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params;

    // ── 1. Authenticate ─────────────────────────────────────────────────
    let currentUser: { id: string; role: "admin" | "agent" | "karyawan"; fullName?: string } | null = null;
    const session = await getServerSession();
    if (session) {
      currentUser = { id: session.id, role: session.role, fullName: session.fullName };
    } else if (isSupabaseConfigured) {
      const { createSupabaseServerClient } = await import("@/lib/supabase-server");
      const supabase = await createSupabaseServerClient();
      if (supabase) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          currentUser = {
            id: user.id,
            role: (user.user_metadata?.role as "admin" | "agent" | "karyawan") || "karyawan",
            fullName: user.user_metadata?.full_name,
          };
        }
      }
    }

    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // ── 2. Rate Limiting (Max 15 comments / minute) ─────────────────────
    const rateLimit = await checkRateLimit(currentUser.id, LIMIT_CONFIGS.COMMENT_CREATE);
    if (!rateLimit.success) {
      return createRateLimitResponse(
        rateLimit,
        "Terlalu banyak komentar yang dikirim (maksimal 15 komentar per menit). Silakan tunggu sebentar."
      );
    }

    // ── 3. Zod Validation (Max 1,000 characters) ────────────────────────
    const validation = await validateRequestBody(createCommentSchema, request);
    if (!validation.success) {
      return validation.response;
    }

    const { comment, message, attachmentUrl } = validation.data;
    const finalMessage = (comment || message || "").trim();

    // ── 4. Verify Ticket Existence & Closed State Guard ────────────────
    if (!isSupabaseConfigured) {
      // Mock mode
      const ticket = mockTickets.find((t) => t.id === ticketId);
      if (!ticket) {
        return NextResponse.json(
          { success: false, message: "Tiket tidak ditemukan" },
          { status: 404 }
        );
      }

      if (ticket.status === "closed") {
        return NextResponse.json(
          {
            success: false,
            message: "Tiket telah ditutup. Komentar baru tidak diperbolehkan.",
          },
          { status: 400 }
        );
      }

      // Karyawan can only comment on their own ticket
      if (currentUser.role === "karyawan" && ticket.createdById !== currentUser.id) {
        return NextResponse.json(
          {
            success: false,
            message: "Anda tidak memiliki izin untuk mengomentari tiket ini.",
          },
          { status: 403 }
        );
      }

      const newMockComment = {
        id: `c-${Date.now()}`,
        ticketId,
        authorId: currentUser.id,
        content: finalMessage,
        createdAt: new Date().toISOString(),
        isSystem: false,
      };
      mockComments.push(newMockComment);

      return NextResponse.json(
        {
          success: true,
          data: {
            id: newMockComment.id,
            ticketId,
            userId: currentUser.id,
            message: finalMessage,
            attachmentUrl: attachmentUrl ?? null,
            createdAt: newMockComment.createdAt,
            user: {
              id: currentUser.id,
              fullName: currentUser.fullName || "User",
              role: currentUser.role,
            },
          },
        },
        { status: 201 }
      );
    }

    // Real mode: Drizzle ORM query & check
    const { db } = await import("@/db");
    const { tickets, ticketComments } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const [ticket] = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        createdById: tickets.createdById,
        assignedToId: tickets.assignedToId,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      return NextResponse.json(
        { success: false, message: "Tiket tidak ditemukan" },
        { status: 404 }
      );
    }

    if (ticket.status === "closed") {
      return NextResponse.json(
        {
          success: false,
          message: "Tiket telah ditutup. Komentar baru tidak diperbolehkan.",
        },
        { status: 400 }
      );
    }

    // Authorization: karyawan can only comment on their own ticket
    if (currentUser.role === "karyawan" && ticket.createdById !== currentUser.id) {
      return NextResponse.json(
        {
          success: false,
          message: "Anda tidak memiliki izin untuk mengomentari tiket ini.",
        },
        { status: 403 }
      );
    }

    const [newComment] = await db
      .insert(ticketComments)
      .values({
        ticketId,
        userId: currentUser.id,
        message: finalMessage,
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
