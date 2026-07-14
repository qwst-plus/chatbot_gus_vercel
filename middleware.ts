// middleware.ts
// 社内向け管理ツール（トップページ・ダッシュボード等）へのアクセスをログイン必須にする。
// /embed と /api/* は旭川ガス公式サイトに埋め込まれる公開チャットウィジェットが使うため、
// 絶対にここでゲートしない。
import { NextResponse, type NextRequest } from "next/server";
import { verifySessionValue } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const session = await verifySessionValue(req.cookies.get("session")?.value);
  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/ingest/:path*",
    "/websites/:path*",
    "/chat",
    "/chat-widget",
    "/admin/:path*",
    "/apikey",
    "/settings/:path*",
  ],
};
