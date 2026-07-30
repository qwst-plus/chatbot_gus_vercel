import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySessionValue } from "@/lib/auth";
import { requireQuest } from "@/lib/credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

const SUPABASE_URL = env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL") ?? "";
const SUPABASE_KEY =
  env("SUPABASE_SERVER_KEY") ??
  env("SUPABASE_SERVICE_ROLE_KEY") ??
  env("SUPABASE_ANON_KEY") ??
  env("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
  "";

// ingest_state テーブルの site_id=-1 を地震ステータス専用レコードとして使用
// status='emergency' のとき is_active=true
// last_url=震度（例: "5+"）、last_error=地域名
const EARTHQUAKE_SITE_ID = -1;

// ── PATCH: 管理者による手動操作（解除 / タイマー延長）──────────────────
// 解除:  PATCH { "action": "clear" }
// 延長:  PATCH { "action": "extend" }  → updated_at を現在時刻にリセット（新たに2時間）
// 認証は以下のいずれか: ① ADMIN_SECRET（外部/API利用）② クウェスト社内アカウントの
// ログインセッション（運用ダッシュボードの手動操作ボタンから、ADMIN_SECRETをブラウザに
// 露出させずに呼べるようにするため）
export async function PATCH(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;
  const authHeader = req.headers.get("authorization");
  const hasValidSecret = !!adminSecret && authHeader === `Bearer ${adminSecret}`;

  let isQuestUser = false;
  if (!hasValidSecret) {
    const session = await verifySessionValue(req.cookies.get("session")?.value);
    if (session) {
      isQuestUser = !!(await requireQuest(session.userId));
    }
  }

  if (!hasValidSecret && !isQuestUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const body = (await req.json()) as { action?: string };

    if (body.action === "clear") {
      await supabase
        .from("ingest_state")
        .update({ status: "idle", last_url: null, last_error: null })
        .eq("site_id", EARTHQUAKE_SITE_ID);
      return NextResponse.json({ ok: true, action: "cleared" });
    }

    if (body.action === "extend") {
      // updated_at を現在時刻にリセット → 2時間タイマーを再スタート
      await supabase
        .from("ingest_state")
        .update({ updated_at: new Date().toISOString() })
        .eq("site_id", EARTHQUAKE_SITE_ID);
      return NextResponse.json({ ok: true, action: "extended" });
    }

    return NextResponse.json({ error: "action must be 'clear' or 'extend'" }, { status: 400 });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from("ingest_state")
      .select("status, last_url, last_error, updated_at")
      .eq("site_id", EARTHQUAKE_SITE_ID)
      .single();

    if (error || !data) {
      return NextResponse.json({ is_active: false });
    }

    const isActive = data.status === "emergency";

    return NextResponse.json({
      is_active: isActive,
      intensity: isActive ? (data.last_url ?? null) : null,
      area: isActive ? (data.last_error ?? null) : null,
      detected_at: isActive ? (data.updated_at ?? null) : null,
    });
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("[earthquake-status] error:", err?.message);
    return NextResponse.json({ is_active: false });
  }
}
