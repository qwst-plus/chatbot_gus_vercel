// app/api/knowledge/route.ts
// RAGナレッジ（documentsテーブル）のCRUD管理API

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/knowledge?page=1&limit=50
// ナレッジ一覧を取得（source_url / title / category / chunk_strategyを返す）
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50")));
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
      .from("documents")
      .select(
        "id, title, source, source_url, category, chunk_strategy, last_crawled_at, created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    return NextResponse.json({
      data: data ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}

// DELETE /api/knowledge?id=<doc_id>
// ドキュメントを削除
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("documents")
      .delete()
      .eq("id", id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, deleted_id: id });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}

// PATCH /api/knowledge
// body: { id, category?, title? }  ← カテゴリ・タイトルを手動で更新
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as {
      id?: string;
      category?: string[];
      title?: string;
    };

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.category !== undefined) updates.category = body.category;
    if (body.title !== undefined) updates.title = body.title;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "no fields to update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("documents")
      .update(updates)
      .eq("id", body.id)
      .select("id, title, category")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}
