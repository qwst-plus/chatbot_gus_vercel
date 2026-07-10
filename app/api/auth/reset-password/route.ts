// app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resetPassword, verifyPasswordResetToken } from "@/lib/credentials";

export const runtime = "nodejs";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { token?: string; password?: string };
    const token = body.token ?? "";
    const password = body.password ?? "";

    if (!token || !password) {
      return NextResponse.json({ error: "トークンまたはパスワードが未入力です" }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください` },
        { status: 400 }
      );
    }

    const user = await verifyPasswordResetToken(token);
    if (!user) {
      return NextResponse.json(
        { error: "リンクの有効期限が切れているか、無効です。もう一度お試しください" },
        { status: 400 }
      );
    }

    await resetPassword(user.id, password);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}
