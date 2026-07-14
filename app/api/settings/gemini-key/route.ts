// app/api/settings/gemini-key/route.ts
// クウェスト社内アカウント専用：Gemini API Keyの保存状況確認・更新。
// 保存はSupabase(app_settings)への暗号化保存のみで、実際のチャット応答は
// 引き続きRender/Vercelの環境変数(GEMINI_API_KEY)を使用する（即時反映はしない）。
import { NextRequest, NextResponse } from "next/server";
import { verifySessionValue } from "@/lib/auth";
import { requireQuest } from "@/lib/credentials";
import { supabaseAdmin } from "@/lib/supabase";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/settingsCrypto";

export const runtime = "nodejs";

const SETTING_KEY = "gemini_api_key";

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

  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value, updated_at, updated_by")
    .eq("key", SETTING_KEY)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ hasKey: false });
  }

  let maskedKey = "****";
  try {
    maskedKey = maskSecret(decryptSecret(data.value));
  } catch {
    // 復号に失敗しても保存状態自体は伝える
  }

  return NextResponse.json({
    hasKey: true,
    maskedKey,
    updatedAt: data.updated_at,
    updatedBy: data.updated_by,
  });
}

export async function POST(req: NextRequest) {
  const user = await getQuestOrNull(req);
  if (!user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = (await req.json()) as { apiKey?: string };
  const apiKey = (body.apiKey ?? "").trim();
  if (!apiKey) {
    return NextResponse.json({ error: "APIキーを入力してください" }, { status: 400 });
  }

  const encrypted = encryptSecret(apiKey);
  const { error } = await supabaseAdmin
    .from("app_settings")
    .upsert({
      key: SETTING_KEY,
      value: encrypted,
      updated_at: new Date().toISOString(),
      updated_by: user.email,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, maskedKey: maskSecret(apiKey) });
}
