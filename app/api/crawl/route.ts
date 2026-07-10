// app/api/crawl/route.ts
// 手動クロール実行API
// バックエンドのPython FastAPI（/sites エンドポイント）へリクエストを転送する

import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// POST /api/crawl
// body: { url: string; scope?: string; type?: string }
// バックエンドにサイト登録 → reingest_localを実行
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      url?: string;
      scope?: string;
      type?: string;
      site_id?: number;  // 既存サイトの再クロール時
    };

    // 既存サイトの再クロール
    if (body.site_id) {
      const res = await fetch(
        `${API_BASE}/sites/${body.site_id}/reingest_local`,
        { method: "POST" }
      );
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.detail ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      return NextResponse.json({ ok: true, ...data });
    }

    // 新規サイト登録 → クロール開始
    if (!body.url) {
      return NextResponse.json(
        { error: "url is required" },
        { status: 400 }
      );
    }

    // 1. サイト登録
    const createRes = await fetch(`${API_BASE}/sites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: body.url,
        scope: body.scope ?? body.url,
        type: body.type ?? "web",
      }),
    });
    if (!createRes.ok) {
      const detail = await createRes.json().catch(() => ({}));
      throw new Error(detail?.detail ?? `サイト登録失敗 HTTP ${createRes.status}`);
    }
    const site = await createRes.json();

    // 2. クロール開始（バックグラウンド）
    const reingestRes = await fetch(
      `${API_BASE}/sites/${site.id}/reingest_local`,
      { method: "POST" }
    );
    if (!reingestRes.ok) {
      const detail = await reingestRes.json().catch(() => ({}));
      throw new Error(detail?.detail ?? `クロール開始失敗 HTTP ${reingestRes.status}`);
    }
    const reingestData = await reingestRes.json();

    return NextResponse.json({
      ok: true,
      site_id: site.id,
      url: body.url,
      ...reingestData,
    });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: err?.message ?? String(e) },
      { status: 500 }
    );
  }
}

// GET /api/crawl
// クロール対象サイト一覧を返す
export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/sites`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: err?.message ?? String(e) },
      { status: 500 }
    );
  }
}
