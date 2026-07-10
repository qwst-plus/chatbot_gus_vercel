// app/api/earthquake-check/route.ts
// Vercel Cron（毎分実行）から呼ばれる地震監視エンドポイント
// P2P地震情報APIをポーリングし、北海道で震度4以上を検知したら緊急モードを発動する
// 最後の更新から AUTO_CLEAR_HOURS 時間経過で自動解除

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── 設定 ──────────────────────────────────────────────
const AUTO_CLEAR_HOURS = 2;           // 自動解除までの時間
const EARTHQUAKE_SCALE_THRESHOLD = 40; // 震度4以上（40=4, 45=5弱, 50=5強, 55=6弱, 60=6強, 70=7）
const LOOKBACK_MINUTES = 3;            // Cronの間隔より少し長め（取りこぼし防止）
const TARGET_PREF = "北海道";
const EARTHQUAKE_SITE_ID = -1;

// 震度スケール → 表示文字列
const SCALE_LABELS: Record<number, string> = {
  10: "1", 20: "2", 30: "3", 40: "4",
  45: "5弱", 50: "5強", 55: "6弱", 60: "6強", 70: "7",
};

// ── Supabase ──────────────────────────────────────────
function env(name: string) {
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

// ── P2P地震情報 API 型定義 ─────────────────────────────
type P2PPoint = {
  pref: string;
  addr: string;
  scale: number;
};

type P2PEvent = {
  id: string;
  code: number;
  time: string; // "YYYY/MM/DD HH:mm:ss"
  data?: {
    earthquake?: {
      time?: string;
      hypocenter?: { name?: string };
      maxScale?: number;
    };
    points?: P2PPoint[];
  };
};

// ── P2P地震情報 API から最新データ取得 ────────────────
async function fetchRecentEarthquakes(): Promise<P2PEvent[]> {
  const res = await fetch(
    "https://api.p2pquake.net/v2/history?codes=551&limit=10",
    {
      headers: { "User-Agent": "asahikawa-gas-chatbot/1.0 (earthquake-monitor)" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 0 },
    }
  );
  if (!res.ok) throw new Error(`P2P API responded ${res.status}`);
  return res.json() as Promise<P2PEvent[]>;
}

// ── 北海道で震度閾値以上の地震を検索 ─────────────────
function findRelevantEarthquake(
  events: P2PEvent[]
): { intensity: string; area: string } | null {
  const cutoff = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000);

  for (const event of events) {
    // 時刻パース（"YYYY/MM/DD HH:mm:ss" → Date）
    const eventTime = new Date(event.time.replace(/\//g, "-").replace(" ", "T"));
    if (isNaN(eventTime.getTime()) || eventTime < cutoff) continue;

    const points: P2PPoint[] = event.data?.points ?? [];
    const hokkaido = points.filter(
      (p) => p.pref === TARGET_PREF && p.scale >= EARTHQUAKE_SCALE_THRESHOLD
    );
    if (hokkaido.length === 0) continue;

    // 最大震度の観測点を代表エリアとする
    const maxScale = Math.max(...hokkaido.map((p) => p.scale));
    const maxPoint = hokkaido.find((p) => p.scale === maxScale)!;

    return {
      intensity: SCALE_LABELS[maxScale] ?? String(maxScale),
      area: maxPoint.addr || TARGET_PREF,
    };
  }
  return null;
}

// ── GET: Vercel Cron から呼ばれるメインハンドラ ────────
export async function GET(req: NextRequest) {
  // Vercel Cron は Authorization: Bearer <CRON_SECRET> を自動付与する
  const authHeader = req.headers.get("authorization");
  const cronSecret = env("CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // ── 1) 現在のSupabase状態を取得 ──────────────────
    const { data: current } = await supabase
      .from("ingest_state")
      .select("status, updated_at")
      .eq("site_id", EARTHQUAKE_SITE_ID)
      .single();

    const isEmergency = current?.status === "emergency";
    const lastUpdate = current?.updated_at ? new Date(current.updated_at) : null;

    // ── 2) 自動解除チェック（2時間経過かつ新規地震なし） ──
    const autoClearCutoff = new Date(Date.now() - AUTO_CLEAR_HOURS * 60 * 60 * 1000);
    if (isEmergency && lastUpdate && lastUpdate < autoClearCutoff) {
      await supabase
        .from("ingest_state")
        .update({ status: "idle", last_url: null, last_error: null })
        .eq("site_id", EARTHQUAKE_SITE_ID);

      console.log("[earthquake-check] auto-cleared after", AUTO_CLEAR_HOURS, "hours");
      return NextResponse.json({ action: "auto_cleared", reason: "2h_elapsed" });
    }

    // ── 3) P2P地震情報APIをポーリング ────────────────
    // ?mock=1 はローカル開発専用（CRON_SECRETが未設定の場合のみ有効）
    const isMock = !cronSecret && req.nextUrl.searchParams.get("mock") === "1";
    let detected: { intensity: string; area: string } | null = null;

    if (isMock) {
      detected = {
        intensity: req.nextUrl.searchParams.get("intensity") ?? "5強",
        area: req.nextUrl.searchParams.get("area") ?? "旭川市",
      };
    } else {
      let events: P2PEvent[] = [];
      try {
        events = await fetchRecentEarthquakes();
      } catch (fetchErr) {
        // APIが落ちていても緊急解除はしない（フォールスルー）
        console.error("[earthquake-check] P2P API fetch failed:", fetchErr);
        return NextResponse.json({ action: "skipped", reason: "api_unavailable" });
      }
      detected = findRelevantEarthquake(events);
    }

    if (detected) {
      // 緊急発動（またはタイマーリセット）
      await supabase.from("ingest_state").upsert(
        {
          site_id: EARTHQUAKE_SITE_ID,
          status: "emergency",
          last_url: detected.intensity,
          last_error: detected.area,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "site_id" }
      );

      const action = isEmergency ? "timer_reset" : "triggered";
      console.log(`[earthquake-check] ${action}: 震度${detected.intensity} / ${detected.area}`);
      return NextResponse.json({ action, earthquake: detected });
    }

    // ── 5) 何もなし ───────────────────────────────────
    return NextResponse.json({
      action: "no_change",
      is_emergency: isEmergency,
      auto_clear_at: isEmergency && lastUpdate
        ? new Date(lastUpdate.getTime() + AUTO_CLEAR_HOURS * 60 * 60 * 1000).toISOString()
        : null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[earthquake-check] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
