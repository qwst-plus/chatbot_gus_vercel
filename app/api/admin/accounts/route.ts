// app/api/admin/accounts/route.ts
// asahikawa-gas ロールの管理者専用：一般アカウントの一覧取得・新規作成
import { NextRequest, NextResponse } from "next/server";
import { verifySessionValue } from "@/lib/auth";
import {
  createManagedAccount,
  listManagedAccounts,
  requireAsahikawaGasAdmin,
} from "@/lib/credentials";

export const runtime = "nodejs";

async function getAdminOrNull(req: NextRequest) {
  const session = await verifySessionValue(req.cookies.get("session")?.value);
  if (!session) return null;
  return requireAsahikawaGasAdmin(session.userId);
}

export async function GET(req: NextRequest) {
  const admin = await getAdminOrNull(req);
  if (!admin) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  const accounts = await listManagedAccounts();
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const admin = await getAdminOrNull(req);
  if (!admin) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = (await req.json()) as { email?: string; name?: string; password?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  const password = body.password ?? "";

  if (!email || !name || !password) {
    return NextResponse.json({ error: "メールアドレス・名前・パスワードは必須です" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "パスワードは8文字以上で入力してください" }, { status: 400 });
  }

  const result = await createManagedAccount(email, name, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
