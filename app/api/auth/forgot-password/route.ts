// app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createPasswordResetToken, getUserByEmail } from "@/lib/credentials";
import { sendPasswordResetEmail } from "@/lib/email";

export const runtime = "nodejs";

// メール登録の有無に関わらず常に同じレスポンスを返し、
// 登録済みメールアドレスの詮索（アカウント列挙）を防ぐ。
const GENERIC_MESSAGE =
  "ご入力のメールアドレスが登録されている場合、パスワード再設定のご案内を送信しました。";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string };
    const email = (body.email ?? "").trim().toLowerCase();

    if (email) {
      const user = await getUserByEmail(email);
      if (user) {
        const token = await createPasswordResetToken(user.id);
        const resetUrl = new URL("/reset-password", req.nextUrl.origin);
        resetUrl.searchParams.set("token", token);
        await sendPasswordResetEmail(user.email, resetUrl.toString());
      }
    }

    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}
