import { NextResponse } from "next/server";
import { mockTickets, mockCategories, mockUsers } from "@/lib/mock-data";
import {
  validateExportDateRange,
  checkExportCooldown,
  escapeCsvField,
  MAX_EXPORT_ROW_LIMIT,
} from "@/lib/export-guard";

const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * GET /api/v1/tickets/export
 *
 * Query Parameters:
 * - startDate: ISO string or YYYY-MM-DD (required)
 * - endDate: ISO string or YYYY-MM-DD (required)
 * - format: 'csv' (default)
 *
 * Protection rules:
 * 1. 2-minute cooldown per user/IP.
 * 2. Maximum date range span: 30 days.
 * 3. Hard cap limit: 1,000 rows.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");
    const formatParam = (url.searchParams.get("format") || "csv").toLowerCase();

    if (!startDateParam || !endDateParam) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Parameter query 'startDate' dan 'endDate' wajib disertakan untuk ekspor laporan.",
        },
        { status: 400 }
      );
    }

    // ── 1. Validate Date Range (Max 30 days, no future dates) ──────────
    const dateCheck = validateExportDateRange(startDateParam, endDateParam);
    if (!dateCheck.isValid || !dateCheck.startDate || !dateCheck.endDate) {
      return NextResponse.json(
        {
          success: false,
          message: dateCheck.error || "Rentang tanggal tidak valid",
        },
        { status: 400 }
      );
    }

    const { startDate, endDate } = dateCheck;

    // ── 2. Authentication & Cooldown Check ──────────────────────────────
    const { getServerSession, decodeSession, SESSION_COOKIE_NAME } = await import("@/lib/auth-session");
    let currentUser: { id: string; role: "admin" | "agent" | "karyawan"; fullName?: string } | null = null;

    const session = await getServerSession();
    if (session) {
      currentUser = { id: session.id, role: session.role, fullName: session.fullName };
    } else {
      const cookieHeader = request.headers.get("cookie");
      if (cookieHeader) {
        const cookies = cookieHeader.split(";").map((c) => c.trim());
        const sessionCookie = cookies.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
        if (sessionCookie) {
          const val = sessionCookie.substring(sessionCookie.indexOf("=") + 1);
          const decoded = decodeSession(val);
          if (decoded) {
            currentUser = { id: decoded.id, role: decoded.role, fullName: decoded.fullName };
          }
        }
      }
    }

    if (!currentUser && isSupabaseConfigured) {
      const { createSupabaseServerClient } = await import("@/lib/supabase-server");
      const { db } = await import("@/db");
      const { users } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");

      const supabase = await createSupabaseServerClient();
      if (supabase) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const [profile] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
          currentUser = {
            id: user.id,
            role: (profile?.role || user.user_metadata?.role || "karyawan") as "admin" | "agent" | "karyawan",
            fullName: profile?.fullName || user.user_metadata?.full_name,
          };
        }
      }
    }

    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Silakan login terlebih dahulu untuk mengekspor data." },
        { status: 401 }
      );
    }

    // Enforce 2-minute cooldown per authenticated user ID
    const cooldownCheck = await checkExportCooldown(currentUser.id);
    if (!cooldownCheck.allowed) {
      return cooldownCheck.response;
    }

    // ── 3. Fetch Data with Hard Cap (1,000 rows) & RBAC ──────────────────
    type ExportTicket = {
      id: string;
      title: string;
      status: string;
      priority: string;
      categoryName: string;
      createdByName: string;
      assignedToName: string;
      createdAt: string;
    };

    let exportRows: ExportTicket[] = [];

    if (!isSupabaseConfigured) {
      // Mock mode: Filter by date range, RBAC ownership, and cap to 1000 items
      const startMs = startDate.getTime();
      const endMs = endDate.getTime();

      exportRows = mockTickets
        .filter((t) => {
          const tTime = new Date(t.createdAt).getTime();
          const inRange = tTime >= startMs && tTime <= endMs;
          if (!inRange) return false;

          // RBAC isolation: karyawan hanya boleh mengekspor tiket miliknya sendiri
          if (currentUser.role === "karyawan" && t.createdById !== currentUser.id) {
            return false;
          }
          // RBAC isolation: agen hanya boleh mengekspor tiket milik sendiri atau tiket unassigned
          if (currentUser.role === "agent" && t.assignedToId && t.assignedToId !== currentUser.id) {
            return false;
          }
          return true;
        })
        .slice(0, MAX_EXPORT_ROW_LIMIT)
        .map((t) => {
          const cat = mockCategories.find((c) => c.id === t.categoryId);
          const creator = mockUsers.find((u) => u.id === t.createdById);
          const agent = mockUsers.find((u) => u.id === t.assignedToId);

          return {
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            categoryName: cat?.name || "-",
            createdByName: creator?.fullName || "-",
            assignedToName: agent?.fullName || "Unassigned",
            createdAt: t.createdAt,
          };
        });
    } else {
      // Real mode: Drizzle ORM query with date filters, RBAC, and hard limit
      const { db } = await import("@/db");
      const { tickets } = await import("@/db/schema");
      const { gte, lte, and, eq, or, isNull } = await import("drizzle-orm");

      const whereConditions = [
        gte(tickets.createdAt, startDate),
        lte(tickets.createdAt, endDate),
      ];

      // RBAC isolation:
      // - karyawan: hanya tiket miliknya sendiri
      // - agent: tiket milik sendiri atau tiket unassigned
      // - admin: seluruh tiket organisasi
      if (currentUser.role === "karyawan") {
        whereConditions.push(eq(tickets.createdById, currentUser.id));
      } else if (currentUser.role === "agent") {
        const agentCondition = or(
          eq(tickets.assignedToId, currentUser.id),
          isNull(tickets.assignedToId)
        );
        if (agentCondition) {
          whereConditions.push(agentCondition);
        }
      }

      const dbTickets = await db.query.tickets.findMany({
        where: and(...whereConditions),
        limit: MAX_EXPORT_ROW_LIMIT,
        with: {
          category: true,
          createdBy: { columns: { fullName: true } },
          assignedTo: { columns: { fullName: true } },
        },
        orderBy: (tickets, { desc }) => [desc(tickets.createdAt)],
      });

      exportRows = dbTickets.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        categoryName: t.category?.name || "-",
        createdByName: t.createdBy?.fullName || "-",
        assignedToName: t.assignedTo?.fullName || "Unassigned",
        createdAt: t.createdAt.toISOString(),
      }));
    }

    // ── 4. Format & Stream Export Response ──────────────────────────────
    if (formatParam === "csv") {
      const headers = [
        "ID Tiket",
        "Judul",
        "Status",
        "Prioritas",
        "Kategori",
        "Pembuat",
        "Ditugaskan Kepada",
        "Tanggal Dibuat",
      ];

      const csvRows = [headers.join(",")];

      for (const row of exportRows) {
        const line = [
          escapeCsvField(row.id),
          escapeCsvField(row.title),
          escapeCsvField(row.status),
          escapeCsvField(row.priority),
          escapeCsvField(row.categoryName),
          escapeCsvField(row.createdByName),
          escapeCsvField(row.assignedToName),
          escapeCsvField(row.createdAt),
        ].join(",");
        csvRows.push(line);
      }

      const csvContent = "\uFEFF" + csvRows.join("\r\n"); // UTF-8 BOM for Excel compatibility
      const filename = `tickets-export-${new Date().toISOString().slice(0, 10)}.csv`;

      return new Response(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "X-Exported-Rows": String(exportRows.length),
        },
      });
    }

    // If json requested
    return NextResponse.json({
      success: true,
      meta: {
        totalRows: exportRows.length,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        hardCapLimit: MAX_EXPORT_ROW_LIMIT,
      },
      data: exportRows,
    });
  } catch (error) {
    console.error("[GET /api/v1/tickets/export]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server saat mengekspor data" },
      { status: 500 }
    );
  }
}
