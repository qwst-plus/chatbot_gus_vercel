// app/api/settings/role-accounts/route.ts
// クウェスト社内アカウント専用：ロール横断のアカウント一覧取得・新規作成。
// ?role=asahikawa-gas（クライアントユーザー管理）または ?role=quest（アカウント管理）で切替。
import { NextRequest, NextResponse } from "next/server";
import { verifySessionValue } from "@/lib/auth";
import { requireQuest, listRoleAccounts, createRoleAccount, ROLE_MAX_ACCOUNTS } from "@/lib/credentials";
import type { Role } from "@/lib/auth";

export const runtime = "nodejs";

function parseRole(value: string | null): Role | null {
  return value === "asahikawa-gas" || value === "quest" ? value : null;
}

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
  const role = parseRole(new URL(req.url).searchParams.get("role"));
  if (!role) {
    return NextResponse.json({ error: "roleパラメータが不正です" }, { status: 400 });
  }
  const accounts = await listRoleAccounts(role);
  return NextResponse.json({ accounts, maxAccounts: ROLE_MAX_ACCOUNTS[role] });
}

export async function POST(req: NextRequest) {
  const user = await getQuestOrNull(req);
  if (!user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = (await req.json()) as { role?: string; email?: string; name?: string; password?: string };
  const role = parseRole(body.role ?? null);
  if (!role) {
    return NextResponse.json({ error: "roleパラメータが不正です" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  const password = body.password ?? "";
  if (!email || !name || !password) {
    return NextResponse.json({ error: "メールアドレス・名前・パスワードは必須です" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "パスワードは8文字以上で入力してください" }, { status: 400 });
  }

  const result = await createRoleAccount(role, email, name, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
