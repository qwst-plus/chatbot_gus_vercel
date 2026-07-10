// app/api/dashboard/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID ?? "default";

// GET /api/dashboard/export?from=2026-01-01&to=2026-05-31
// 会話ログをCSV形式で返す
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let query = supabaseAdmin
      .from("conversations")
      .select("id, session_id, category_id, mode, started_at, ended_at, escalated, escalate_type, resolved, resolved_method")
      .eq("client_id", CLIENT_ID)
      .order("started_at", { ascending: false });

    if (from) query = query.gte("started_at", from);
    if (to) query = query.lte("started_at", `${to}T23:59:59Z`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = data ?? [];

    // CSVヘッダー
    const headers = [
      "id",
      "session_id",
      "category_id",
      "mode",
      "started_at",
      "ended_at",
      "escalated",
      "escalate_type",
      "resolved",
      "resolved_method",
    ];

    const escape = (v: unknown): string => {
      const s = v == null ? "" : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const csvLines = [
      headers.join(","),
      ...rows.map((row) =>
        headers.map((h) => escape((row as Record<string, unknown>)[h])).join(",")
      ),
    ];

    return new NextResponse(csvLines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="conversations_${CLIENT_ID}_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}
