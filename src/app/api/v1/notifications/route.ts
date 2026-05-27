import { NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, ticketComments, users } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { eq, ne, desc, and } from "drizzle-orm";

export async function GET(_request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const [profile] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!profile) {
      return NextResponse.json({ success: false, message: "User profile not found" }, { status: 404 });
    }

    let recentComments;

    if (profile.role === "karyawan") {
      recentComments = await db.select({
        id: ticketComments.id,
        message: ticketComments.message,
        createdAt: ticketComments.createdAt,
        ticketId: tickets.id,
        ticketTitle: tickets.title,
        authorName: users.fullName
      })
      .from(ticketComments)
      .innerJoin(tickets, eq(ticketComments.ticketId, tickets.id))
      .innerJoin(users, eq(ticketComments.userId, users.id))
      .where(
        and(
          eq(tickets.createdById, user.id),
          ne(ticketComments.userId, user.id)
        )
      )
      .orderBy(desc(ticketComments.createdAt))
      .limit(5);
    } else if (profile.role === "agent") {
      recentComments = await db.select({
        id: ticketComments.id,
        message: ticketComments.message,
        createdAt: ticketComments.createdAt,
        ticketId: tickets.id,
        ticketTitle: tickets.title,
        authorName: users.fullName
      })
      .from(ticketComments)
      .innerJoin(tickets, eq(ticketComments.ticketId, tickets.id))
      .innerJoin(users, eq(ticketComments.userId, users.id))
      .where(
        and(
          eq(tickets.assignedToId, user.id),
          ne(ticketComments.userId, user.id)
        )
      )
      .orderBy(desc(ticketComments.createdAt))
      .limit(5);
    } else {
      // admin sees all recent comments by others
      recentComments = await db.select({
        id: ticketComments.id,
        message: ticketComments.message,
        createdAt: ticketComments.createdAt,
        ticketId: tickets.id,
        ticketTitle: tickets.title,
        authorName: users.fullName
      })
      .from(ticketComments)
      .innerJoin(tickets, eq(ticketComments.ticketId, tickets.id))
      .innerJoin(users, eq(ticketComments.userId, users.id))
      .where(ne(ticketComments.userId, user.id))
      .orderBy(desc(ticketComments.createdAt))
      .limit(5);
    }

    return NextResponse.json({ success: true, data: recentComments });
  } catch (error) {
    console.error("[GET /api/v1/notifications]", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
