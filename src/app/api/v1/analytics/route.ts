import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { mockTickets } from "@/lib/mock-data";

const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Calculates start of period (daily, monthly, yearly) in the given timezone (defaults to Asia/Jakarta / UTC+7).
 */
export function getStartOfPeriod(
  timeRange: string,
  now = new Date(),
  timeZone = "Asia/Jakarta"
): Date {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value || "1970";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";

  if (timeRange === "daily") {
    return new Date(`${year}-${month}-${day}T00:00:00.000+07:00`);
  }
  if (timeRange === "monthly") {
    return new Date(`${year}-${month}-01T00:00:00.000+07:00`);
  }
  if (timeRange === "yearly") {
    return new Date(`${year}-01-01T00:00:00.000+07:00`);
  }
  return new Date(0);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const timeRange = url.searchParams.get("timeRange") || "all";
    const agentId = url.searchParams.get("agentId") || "all";
    const timeZone = url.searchParams.get("tz") || "Asia/Jakarta";

    if (!isSupabaseConfigured) {
      let filtered = mockTickets;
      if (agentId !== "all") {
        filtered = filtered.filter((t) => t.assignedToId === agentId);
      }
      if (timeRange !== "all") {
        const startDate = getStartOfPeriod(timeRange, new Date(), timeZone);
        filtered = filtered.filter((t) => {
          const d = new Date(t.createdAt);
          return d >= startDate;
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

    let userId = user?.id;
    let userRole: string | undefined;

    if (userId) {
      const [profile] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (profile) {
        userRole = profile.role;
      }
    } else {
      const { getServerSession, decodeSession, SESSION_COOKIE_NAME } = await import("@/lib/auth-session");
      const session = await getServerSession();
      if (session) {
        userId = session.id;
        userRole = session.role;
      } else {
        const cookieHeader = request.headers.get("cookie");
        if (cookieHeader) {
          const cookies = cookieHeader.split(";").map((c) => c.trim());
          const sessionCookie = cookies.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
          if (sessionCookie) {
            const val = sessionCookie.substring(sessionCookie.indexOf("=") + 1);
            const decoded = decodeSession(val);
            if (decoded) {
              userId = decoded.id;
              userRole = decoded.role;
            }
          }
        }
      }
    }

    if (!userId || !userRole) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const conditions = [];

    let filterAgentId = agentId;
    if (userRole === "agent") {
      filterAgentId = userId;
    } else if (userRole === "karyawan") {
      conditions.push(eq(tickets.createdById, userId));
    }

    if (filterAgentId !== "all" && userRole !== "karyawan") {
      conditions.push(eq(tickets.assignedToId, filterAgentId));
    }

    if (timeRange !== "all") {
      const startDate = getStartOfPeriod(timeRange, new Date(), timeZone);
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
