// app/api/settings/role-accounts/[id]/route.ts
// クウェスト社内アカウント専用：ロール横断のアカウント更新・削除。
import { NextRequest, NextResponse } from "next/server";
import { verifySessionValue } from "@/lib/auth";
import { requireQuest, updateRoleAccount, deleteRoleAccount } from "@/lib/credentials";
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getQuestOrNull(req);
  if (!user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json()) as { role?: string; email?: string; name?: string; password?: string };
  const role = parseRole(body.role ?? null);
  if (!role) {
    return NextResponse.json({ error: "roleパラメータが不正です" }, { status: 400 });
  }

  const result = await updateRoleAccount(role, id, {
    email: body.email,
    name: body.name,
    password: body.password,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getQuestOrNull(req);
  if (!user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  const { id } = await params;
  const role = parseRole(new URL(req.url).searchParams.get("role"));
  if (!role) {
    return NextResponse.json({ error: "roleパラメータが不正です" }, { status: 400 });
  }

  const result = await deleteRoleAccount(role, id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
