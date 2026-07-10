// app/api/admin/accounts/[id]/route.ts
// asahikawa-gas ロールの管理者専用：一般アカウントの編集・削除
import { NextRequest, NextResponse } from "next/server";
import { verifySessionValue } from "@/lib/auth";
import {
  deleteManagedAccount,
  requireAsahikawaGasAdmin,
  updateManagedAccount,
} from "@/lib/credentials";

export const runtime = "nodejs";

async function getAdminOrNull(req: NextRequest) {
  const session = await verifySessionValue(req.cookies.get("session")?.value);
  if (!session) return null;
  return requireAsahikawaGasAdmin(session.userId);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminOrNull(req);
  if (!admin) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json()) as { email?: string; name?: string; password?: string };

  if (body.password && body.password.length < 8) {
    return NextResponse.json({ error: "パスワードは8文字以上で入力してください" }, { status: 400 });
  }

  const result = await updateManagedAccount(id, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminOrNull(req);
  if (!admin) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const result = await deleteManagedAccount(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
