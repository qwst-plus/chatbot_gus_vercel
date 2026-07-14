// app/api/settings/chat-icon/route.ts
// クウェスト社内アカウント専用：チャットウィジェットのアイコン画像・タイトルの確認・更新。
import { NextRequest, NextResponse } from "next/server";
import { verifySessionValue } from "@/lib/auth";
import { requireQuest } from "@/lib/credentials";
import { getSetting, setSetting, deleteSetting } from "@/lib/appSettings";
import { supabaseAdmin } from "@/lib/supabase";
import {
  DEFAULT_CHAT_ICON_URL,
  DEFAULT_CHAT_WIDGET_TITLE,
  getChatWidgetBranding,
} from "@/lib/chatWidgetBranding";

export const runtime = "nodejs";

const ICON_URL_KEY = "chat_icon_url";
const TITLE_KEY = "chat_widget_title";
const BUCKET = "chat-icons";
const MAX_ICON_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

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
  const branding = await getChatWidgetBranding();
  return NextResponse.json({
    ...branding,
    defaultIconUrl: DEFAULT_CHAT_ICON_URL,
    defaultTitle: DEFAULT_CHAT_WIDGET_TITLE,
  });
}

export async function POST(req: NextRequest) {
  const user = await getQuestOrNull(req);
  if (!user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const form = await req.formData();
  const icon = form.get("icon");
  const title = form.get("title");

  if (icon instanceof File && icon.size > 0) {
    if (!ALLOWED_TYPES.includes(icon.type)) {
      return NextResponse.json({ error: "画像はPNG/JPEG/WebPのみ対応しています" }, { status: 400 });
    }
    if (icon.size > MAX_ICON_BYTES) {
      return NextResponse.json({ error: "画像サイズは2MB以下にしてください" }, { status: 400 });
    }
    const ext = icon.type === "image/png" ? "png" : icon.type === "image/webp" ? "webp" : "jpg";
    const path = `icon-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await icon.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: icon.type, upsert: true });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    await setSetting(ICON_URL_KEY, publicUrlData.publicUrl, user.email);
  }

  if (typeof title === "string" && title.trim()) {
    await setSetting(TITLE_KEY, title.trim(), user.email);
  }

  const branding = await getChatWidgetBranding();
  return NextResponse.json({ ok: true, ...branding });
}

export async function DELETE(req: NextRequest) {
  const user = await getQuestOrNull(req);
  if (!user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  await Promise.all([deleteSetting(ICON_URL_KEY), deleteSetting(TITLE_KEY)]);
  return NextResponse.json({ ok: true });
}
