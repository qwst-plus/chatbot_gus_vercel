// app/api/settings/prompt/route.ts
// クウェスト社内アカウント専用：チャット回答のシステムプロンプト（基本テンプレート）の確認・更新。
import { NextRequest, NextResponse } from "next/server";
import { verifySessionValue } from "@/lib/auth";
import { requireQuest } from "@/lib/credentials";
import { getSetting, setSetting, deleteSetting } from "@/lib/appSettings";
import { DEFAULT_SYSTEM_PROMPT_TEMPLATE } from "@/lib/systemPrompt";

export const runtime = "nodejs";

const SETTING_KEY = "system_prompt_template";

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
  const template = raw && raw.trim() ? raw : DEFAULT_SYSTEM_PROMPT_TEMPLATE;
  return NextResponse.json({ template, isDefault: !raw, defaultTemplate: DEFAULT_SYSTEM_PROMPT_TEMPLATE });
}

export async function POST(req: NextRequest) {
  const user = await getQuestOrNull(req);
  if (!user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = (await req.json()) as { template?: string };
  const template = (body.template ?? "").trim();
  if (!template) {
    return NextResponse.json({ error: "プロンプトを入力してください" }, { status: 400 });
  }

  await setSetting(SETTING_KEY, template, user.email);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getQuestOrNull(req);
  if (!user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  await deleteSetting(SETTING_KEY);
  return NextResponse.json({ ok: true });
}
