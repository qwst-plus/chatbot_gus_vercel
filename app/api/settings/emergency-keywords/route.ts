// app/api/settings/emergency-keywords/route.ts
// クウェスト社内アカウント専用：緊急ワード（エスカレーション判定キーワード）の確認・更新。
import { NextRequest, NextResponse } from "next/server";
import { verifySessionValue } from "@/lib/auth";
import { requireQuest } from "@/lib/credentials";
import { getSetting, setSetting, deleteSetting } from "@/lib/appSettings";
import { getClientConfig } from "@/lib/getClientConfig";

export const runtime = "nodejs";

const SETTING_KEY = "emergency_keywords";
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID ?? "asahikawa-gas";

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
  const config = await getClientConfig(CLIENT_ID);
  const raw = await getSetting(SETTING_KEY);
  let keywords = config.emergencyKeywords;
  let isDefault = true;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((k) => typeof k === "string") && parsed.length > 0) {
        keywords = parsed;
        isDefault = false;
      }
    } catch {
      // 壊れたJSONはデフォルト扱い
    }
  }
  return NextResponse.json({ keywords, isDefault, defaultKeywords: config.emergencyKeywords });
}

export async function POST(req: NextRequest) {
  const user = await getQuestOrNull(req);
  if (!user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = (await req.json()) as { keywords?: unknown };
  const keywords = Array.isArray(body.keywords)
    ? body.keywords.map((k) => String(k).trim()).filter((k) => k.length > 0)
    : [];
  if (keywords.length === 0) {
    return NextResponse.json({ error: "キーワードを1件以上指定してください" }, { status: 400 });
  }

  await setSetting(SETTING_KEY, JSON.stringify(keywords), user.email);
  return NextResponse.json({ ok: true, keywords });
}

export async function DELETE(req: NextRequest) {
  const user = await getQuestOrNull(req);
  if (!user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  await deleteSetting(SETTING_KEY);
  return NextResponse.json({ ok: true });
}
