// app/api/chat-config/route.ts
// 公開エンドポイント（無認証）：旭川ガス公式サイトに埋め込まれるChatWidgetが使う
// アイコン画像URL・タイトル文字を返す。/api/* はmiddleware.tsで元々ゲートされていない。
import { NextResponse } from "next/server";
import { getChatWidgetBranding } from "@/lib/chatWidgetBranding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const branding = await getChatWidgetBranding();
  return NextResponse.json(branding);
}
