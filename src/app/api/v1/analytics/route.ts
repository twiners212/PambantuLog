import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { mockTickets } from "@/lib/mock-data";

const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const timeRange = url.searchParams.get("timeRange") || "all";
    const agentId = url.searchParams.get("agentId") || "all";

    if (!isSupabaseConfigured) {
      let filtered = mockTickets;
      if (agentId !== "all") {
        filtered = filtered.filter((t) => t.assignedToId === agentId);
      }
      if (timeRange !== "all") {
        const now = new Date();
        filtered = filtered.filter((t) => {
          const d = new Date(t.createdAt);
          if (timeRange === "daily") return d.toDateString() === now.toDateString();
          if (timeRange === "monthly") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          if (timeRange === "yearly") return d.getFullYear() === now.getFullYear();
          return true;
        });
      }
      const counts = {
        open: filtered.filter((t) => t.status === "open").length,
        in_progress: filtered.filter((t) => t.status === "in_progress").length,
        pending: filtered.filter((t) => t.status === "pending").length,
        resolved: filtered.filter((t) => t.status === "resolved").length,
        closed: filtered.filter((t) => t.status === "closed").length,
      };
      return NextResponse.json({ success: true, data: { counts, total: filtered.length } });
    }

    const { createSupabaseServerClient } = await import("@/lib/supabase-server");
    const { db } = await import("@/db");
    const { tickets, users } = await import("@/db/schema");
    const { eq, and, gte } = await import("drizzle-orm");

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const [profile] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!profile) {
      return NextResponse.json({ success: false, message: "User profile not found" }, { status: 404 });
    }

    const conditions = [];

    let filterAgentId = agentId;
    if (profile.role === "agent") {
      filterAgentId = profile.id;
    } else if (profile.role === "karyawan") {
      conditions.push(eq(tickets.createdById, profile.id));
    }

    if (filterAgentId !== "all" && profile.role !== "karyawan") {
      conditions.push(eq(tickets.assignedToId, filterAgentId));
    }

    if (timeRange !== "all") {
      const now = new Date();
      let startDate: Date;
      if (timeRange === "daily") {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (timeRange === "monthly") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (timeRange === "yearly") {
        startDate = new Date(now.getFullYear(), 0, 1);
      } else {
        startDate = new Date(0);
      }
      conditions.push(gte(tickets.createdAt, startDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select({
        status: tickets.status,
        count: sql<number>`cast(count(${tickets.id}) as integer)`
      })
      .from(tickets)
      .where(whereClause)
      .groupBy(tickets.status);

    const counts = { open: 0, in_progress: 0, pending: 0, resolved: 0, closed: 0 };
    let total = 0;

    for (const row of results) {
      if (row.status in counts) {
        counts[row.status as keyof typeof counts] = row.count;
        total += row.count;
      }
    }

    return NextResponse.json({ success: true, data: { counts, total } });
  } catch (error) {
    console.error("[GET /api/v1/analytics]", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
