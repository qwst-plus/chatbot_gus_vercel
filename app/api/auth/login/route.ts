// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSessionValue } from "@/lib/auth";
import { generateSessionToken, getUserByEmail, verifyPassword } from "@/lib/credentials";

export const runtime = "nodejs";

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7日

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json({ error: "メールアドレスまたはパスワードが違います" }, { status: 401 });
    }

    const user = await getUserByEmail(email);
    const ok = user ? await verifyPassword(password, user.password_hash) : false;

    if (!user || !ok) {
      return NextResponse.json({ error: "メールアドレスまたはパスワードが違います" }, { status: 401 });
    }

    const sessionToken = generateSessionToken();
    const sessionValue = await createSessionValue({
      role: user.role,
      userId: user.id,
      sessionToken,
    });
    const res = NextResponse.json({
      ok: true,
      role: user.role,
      name: user.name,
      isAdmin: user.is_admin,
    });
    res.cookies.set("session", sessionValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SEC,
    });
    return res;
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}
