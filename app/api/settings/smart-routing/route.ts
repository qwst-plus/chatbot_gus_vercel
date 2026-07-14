// app/api/settings/smart-routing/route.ts
// クウェスト社内アカウント専用：スマートルーティングの複雑度しきい値の確認・更新。
// この値を超えるとGemini Flash、以下はFlash-Liteが選ばれる（app/api/chat/route.tsが参照）。
import { NextRequest, NextResponse } from "next/server";
import { verifySessionValue } from "@/lib/auth";
import { requireQuest } from "@/lib/credentials";
import { getSetting, setSetting } from "@/lib/appSettings";
import { DEFAULT_SMART_ROUTING_THRESHOLD } from "@/lib/smartRouting";

export const runtime = "nodejs";

const SETTING_KEY = "smart_routing_threshold";

async function getQuestOrNull(req: NextRequest) {
  const session = await verifySessionValue(req.cookies.get("session")?.value);
  if (!session) return null;
  return requireQuest(session.userId);
}

export async function GET(req: NextRequest) {
  const user = await getQuestOrNull(req);
  if (!user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  const raw = await getSetting(SETTING_KEY);
  const threshold = raw !== null && Number.isFinite(Number(raw)) ? Number(raw) : DEFAULT_SMART_ROUTING_THRESHOLD;
  return NextResponse.json({ threshold, isDefault: raw === null });
}

export async function POST(req: NextRequest) {
  const user = await getQuestOrNull(req);
  if (!user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = (await req.json()) as { threshold?: number };
  const threshold = Number(body.threshold);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    return NextResponse.json({ error: "しきい値は0〜1の範囲で指定してください" }, { status: 400 });
  }

  await setSetting(SETTING_KEY, String(threshold), user.email);
  return NextResponse.json({ ok: true, threshold });
}
